
-- =============== AUDIT LOGS ===============
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_is_admin BOOLEAN NOT NULL DEFAULT false,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  target_user_id UUID,
  old_data JSONB,
  new_data JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;
CREATE POLICY "Admins can read audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs (target_user_id, created_at DESC);

-- Escrita apenas via funções SECURITY DEFINER / service_role (nenhuma policy de INSERT)

CREATE OR REPLACE FUNCTION public.write_audit_log(
  _action TEXT, _entity TEXT, _entity_id TEXT, _target_user_id UUID,
  _old JSONB, _new JSONB, _metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _id UUID; _actor UUID := auth.uid();
BEGIN
  INSERT INTO public.audit_logs (actor_id, actor_is_admin, action, entity, entity_id,
                                 target_user_id, old_data, new_data, metadata)
  VALUES (_actor,
          CASE WHEN _actor IS NULL THEN false ELSE public.has_role(_actor, 'admin') END,
          _action, _entity, _entity_id, _target_user_id, _old, _new, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END; $$;

REVOKE ALL ON FUNCTION public.write_audit_log(TEXT, TEXT, TEXT, UUID, JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_audit_log(TEXT, TEXT, TEXT, UUID, JSONB, JSONB, JSONB) TO service_role;

-- =============== TRIGGERS DE AUDITORIA ===============
CREATE OR REPLACE FUNCTION public.audit_subscriptions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _actor UUID := auth.uid();
BEGIN
  IF TG_OP = 'UPDATE' AND to_jsonb(OLD) = to_jsonb(NEW) THEN RETURN NEW; END IF;
  INSERT INTO public.audit_logs (actor_id, actor_is_admin, action, entity, entity_id, target_user_id, old_data, new_data)
  VALUES (_actor,
          CASE WHEN _actor IS NULL THEN false ELSE public.has_role(_actor,'admin') END,
          lower(TG_OP), 'subscriptions',
          COALESCE(NEW.id, OLD.id)::text,
          COALESCE(NEW.user_id, OLD.user_id),
          CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
          CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_audit_subscriptions ON public.subscriptions;
CREATE TRIGGER trg_audit_subscriptions
AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.audit_subscriptions();

CREATE OR REPLACE FUNCTION public.audit_point_events()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _actor UUID := auth.uid();
BEGIN
  INSERT INTO public.audit_logs (actor_id, actor_is_admin, action, entity, entity_id, target_user_id, new_data, metadata)
  VALUES (_actor,
          CASE WHEN _actor IS NULL THEN false ELSE public.has_role(_actor,'admin') END,
          'points_granted', 'point_events', NEW.id::text, NEW.user_id, to_jsonb(NEW),
          jsonb_build_object('points', NEW.points, 'kind', NEW.kind));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_audit_point_events ON public.point_events;
CREATE TRIGGER trg_audit_point_events
AFTER INSERT ON public.point_events
FOR EACH ROW EXECUTE FUNCTION public.audit_point_events();

CREATE OR REPLACE FUNCTION public.audit_user_roles()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _actor UUID := auth.uid();
BEGIN
  INSERT INTO public.audit_logs (actor_id, actor_is_admin, action, entity, entity_id, target_user_id, old_data, new_data)
  VALUES (_actor,
          CASE WHEN _actor IS NULL THEN false ELSE public.has_role(_actor,'admin') END,
          'role_' || lower(TG_OP), 'user_roles', COALESCE(NEW.id, OLD.id)::text,
          COALESCE(NEW.user_id, OLD.user_id),
          CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
          CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_user_roles();

CREATE OR REPLACE FUNCTION public.audit_reward_redemptions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _actor UUID := auth.uid();
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  INSERT INTO public.audit_logs (actor_id, actor_is_admin, action, entity, entity_id, target_user_id, old_data, new_data)
  VALUES (_actor,
          CASE WHEN _actor IS NULL THEN false ELSE public.has_role(_actor,'admin') END,
          'redemption_' || lower(TG_OP), 'reward_redemptions', NEW.id::text, NEW.user_id,
          CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END, to_jsonb(NEW));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_audit_reward_redemptions ON public.reward_redemptions;
CREATE TRIGGER trg_audit_reward_redemptions
AFTER INSERT OR UPDATE ON public.reward_redemptions
FOR EACH ROW EXECUTE FUNCTION public.audit_reward_redemptions();

CREATE OR REPLACE FUNCTION public.audit_profiles()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _actor UUID := auth.uid();
BEGIN
  IF to_jsonb(OLD) = to_jsonb(NEW) THEN RETURN NEW; END IF;
  INSERT INTO public.audit_logs (actor_id, actor_is_admin, action, entity, entity_id, target_user_id, old_data, new_data)
  VALUES (_actor,
          CASE WHEN _actor IS NULL THEN false ELSE public.has_role(_actor,'admin') END,
          'profile_update', 'profiles', NEW.id::text, NEW.id,
          jsonb_build_object('display_name', OLD.display_name, 'whatsapp', OLD.whatsapp, 'cpf', OLD.cpf, 'referral_code', OLD.referral_code),
          jsonb_build_object('display_name', NEW.display_name, 'whatsapp', NEW.whatsapp, 'cpf', NEW.cpf, 'referral_code', NEW.referral_code));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_profiles();

CREATE OR REPLACE FUNCTION public.audit_app_settings()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _actor UUID := auth.uid();
BEGIN
  INSERT INTO public.audit_logs (actor_id, actor_is_admin, action, entity, entity_id, old_data, new_data)
  VALUES (_actor,
          CASE WHEN _actor IS NULL THEN false ELSE public.has_role(_actor,'admin') END,
          'settings_' || lower(TG_OP), 'app_settings', COALESCE(NEW.key, OLD.key),
          CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END, to_jsonb(NEW));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_audit_app_settings ON public.app_settings;
CREATE TRIGGER trg_audit_app_settings
AFTER INSERT OR UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.audit_app_settings();

-- =============== IDEMPOTÊNCIA DE WEBHOOK ===============
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  event_id TEXT,
  payment_ref TEXT NOT NULL,
  provider TEXT,
  status TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.payment_webhook_events TO service_role;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read webhook events" ON public.payment_webhook_events;
CREATE POLICY "Admins can read webhook events"
  ON public.payment_webhook_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.payment_webhook_events TO authenticated;

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_ref ON public.payment_webhook_events (payment_ref, created_at DESC);
