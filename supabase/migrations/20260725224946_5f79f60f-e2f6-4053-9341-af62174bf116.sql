CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read settings" ON public.app_settings;
CREATE POLICY "Admins read settings" ON public.app_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins write settings" ON public.app_settings;
CREATE POLICY "Admins write settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS payment_ref TEXT,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

INSERT INTO public.app_settings (key, value) VALUES
  ('payments', jsonb_build_object(
     'infinitepay', jsonb_build_object('enabled', true, 'handle', '', 'redirect_url', ''),
     'stripe', jsonb_build_object('enabled', true, 'payment_links', '{}'::jsonb),
     'br_provider', 'infinitepay',
     'intl_provider', 'stripe'
   )),
  ('whatsapp_reminders', jsonb_build_object(
     'enabled', true,
     'days_before', 7,
     'support_number', '',
     'template', 'Olá {nome}! Sua assinatura KMKZ ({plano}) vence em {dias} dia(s), no dia {data}. Renove agora e não fique fora do ar: {link}'
   ))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_checkout_settings()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'br_provider', COALESCE(value->>'br_provider','infinitepay'),
    'intl_provider', COALESCE(value->>'intl_provider','stripe'),
    'infinitepay', jsonb_build_object(
      'enabled', COALESCE((value->'infinitepay'->>'enabled')::boolean, false),
      'handle', COALESCE(value->'infinitepay'->>'handle',''),
      'redirect_url', COALESCE(value->'infinitepay'->>'redirect_url','')
    ),
    'stripe', jsonb_build_object(
      'enabled', COALESCE((value->'stripe'->>'enabled')::boolean, false),
      'payment_links', COALESCE(value->'stripe'->'payment_links', '{}'::jsonb)
    )
  )
  FROM public.app_settings WHERE key = 'payments'
$$;

REVOKE ALL ON FUNCTION public.get_checkout_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_checkout_settings() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_settings(_key TEXT)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _v jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT value INTO _v FROM public.app_settings WHERE key = _key;
  RETURN COALESCE(_v, '{}'::jsonb);
END; $$;

REVOKE ALL ON FUNCTION public.admin_get_settings(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_settings(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_settings(_key TEXT, _value jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.app_settings (key, value) VALUES (_key, _value)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  RETURN _value;
END; $$;

REVOKE ALL ON FUNCTION public.admin_set_settings(TEXT, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_settings(TEXT, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.expiring_subscriptions(_days INT DEFAULT NULL)
RETURNS TABLE(
  subscription_id uuid, user_id uuid, display_name text, whatsapp text,
  plan_name text, ends_at timestamptz, days_left int, reminder_sent_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _d INT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COALESCE(_days, (value->>'days_before')::int, 7) INTO _d
    FROM public.app_settings WHERE key = 'whatsapp_reminders';
  _d := COALESCE(_d, 7);
  RETURN QUERY
    SELECT s.id, s.user_id, p.display_name, COALESCE(p.whatsapp, p.phone),
           pl.name, s.ends_at,
           GREATEST(0, EXTRACT(DAY FROM (s.ends_at - now()))::int),
           s.reminder_sent_at
    FROM public.subscriptions s
    JOIN public.profiles p ON p.id = s.user_id
    JOIN public.plans pl ON pl.id = s.plan_id
    WHERE s.status = 'active'
      AND s.ends_at > now()
      AND s.ends_at <= now() + (_d || ' days')::interval
    ORDER BY s.ends_at ASC;
END; $$;

REVOKE ALL ON FUNCTION public.expiring_subscriptions(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expiring_subscriptions(INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_reminder_sent(_subscription_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.subscriptions SET reminder_sent_at = now() WHERE id = _subscription_id;
  RETURN FOUND;
END; $$;

REVOKE ALL ON FUNCTION public.mark_reminder_sent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_reminder_sent(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.run_expiry_reminders()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cfg jsonb; _d INT; _r RECORD; _count INT := 0;
BEGIN
  SELECT value INTO _cfg FROM public.app_settings WHERE key = 'whatsapp_reminders';
  IF COALESCE((_cfg->>'enabled')::boolean, false) IS NOT TRUE THEN RETURN 0; END IF;
  _d := COALESCE((_cfg->>'days_before')::int, 7);

  FOR _r IN
    SELECT s.id, s.user_id, s.ends_at, pl.name AS plan_name,
           GREATEST(0, EXTRACT(DAY FROM (s.ends_at - now()))::int) AS days_left
    FROM public.subscriptions s
    JOIN public.plans pl ON pl.id = s.plan_id
    WHERE s.status = 'active'
      AND s.ends_at > now()
      AND s.ends_at <= now() + (_d || ' days')::interval
      AND (s.reminder_sent_at IS NULL OR s.reminder_sent_at < now() - INTERVAL '3 days')
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (_r.user_id, 'warning',
      'Sua assinatura está vencendo ⏳',
      'O plano ' || _r.plan_name || ' vence em ' || _r.days_left || ' dia(s). Renove para continuar no ar.',
      '/planos',
      jsonb_build_object('subscription_id', _r.id, 'ends_at', _r.ends_at));
    UPDATE public.subscriptions SET reminder_sent_at = now() WHERE id = _r.id;
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END; $$;

REVOKE ALL ON FUNCTION public.run_expiry_reminders() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('kmkz-expiry-reminders')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kmkz-expiry-reminders');

SELECT cron.schedule('kmkz-expiry-reminders', '0 12 * * *', $$SELECT public.run_expiry_reminders();$$);