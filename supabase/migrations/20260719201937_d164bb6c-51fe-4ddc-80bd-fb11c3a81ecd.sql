
CREATE EXTENSION IF NOT EXISTS pg_cron;

UPDATE public.plans SET referral_points = 100 WHERE period = 'monthly';
UPDATE public.plans SET referral_points = 250 WHERE period = 'quarterly';
UPDATE public.plans SET referral_points = 500 WHERE period = 'semiannual';
UPDATE public.plans SET referral_points = 900 WHERE period = 'annual';

UPDATE public.point_rules SET points = 10 WHERE id = 'signup_bonus';
UPDATE public.point_rules SET points = 5 WHERE id = 'share';
INSERT INTO public.point_rules (id, name, points, daily_limit, active) VALUES
  ('referral_signup', 'Indicação cadastrada', 5, NULL, true),
  ('renewal_monthly', 'Renovação mensal', 20, NULL, true),
  ('renewal_annual', 'Renovação anual', 100, NULL, true)
ON CONFLICT (id) DO UPDATE SET points = EXCLUDED.points, name = EXCLUDED.name, active = true;

UPDATE public.rewards SET active = false;
UPDATE public.rewards SET points_cost = 100, subscription_months = 1, active = true, stock = GREATEST(stock, 999), sort_order = 1
  WHERE name = '1 Mês Grátis';
UPDATE public.rewards SET points_cost = 250, subscription_months = 3, active = true, stock = GREATEST(stock, 999), sort_order = 2
  WHERE name = '3 Meses Grátis';
INSERT INTO public.rewards (name, description, kind, subscription_months, points_cost, stock, active, sort_order)
SELECT '6 Meses Grátis', 'Ganhe 6 meses adicionados à sua assinatura ativa.', 'subscription', 6, 500, 999, true, 3
WHERE NOT EXISTS (SELECT 1 FROM public.rewards WHERE name = '6 Meses Grátis');
UPDATE public.rewards SET points_cost = 500, subscription_months = 6, active = true, stock = 999, sort_order = 3
  WHERE name = '6 Meses Grátis';
INSERT INTO public.rewards (name, description, kind, subscription_months, points_cost, stock, active, sort_order)
SELECT '1 Ano Grátis', 'Ganhe 12 meses adicionados à sua assinatura ativa.', 'subscription', 12, 900, 999, true, 4
WHERE NOT EXISTS (SELECT 1 FROM public.rewards WHERE name = '1 Ano Grátis');
UPDATE public.rewards SET points_cost = 900, subscription_months = 12, active = true, stock = 999, sort_order = 4
  WHERE name = '1 Ano Grátis';
UPDATE public.rewards SET points_cost = 1500, active = true, sort_order = 5
  WHERE name = 'Mi TV Stick';

ALTER TABLE public.point_events
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expired BOOLEAN NOT NULL DEFAULT false;

UPDATE public.point_events
  SET expires_at = created_at + INTERVAL '12 months'
  WHERE expires_at IS NULL AND points > 0;

CREATE INDEX IF NOT EXISTS idx_point_events_expiry
  ON public.point_events (expires_at) WHERE points > 0 AND expired = false;

CREATE OR REPLACE FUNCTION public.set_point_event_expiry()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.points > 0 AND NEW.expires_at IS NULL THEN
    NEW.expires_at := COALESCE(NEW.created_at, now()) + INTERVAL '12 months';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_point_event_expiry ON public.point_events;
CREATE TRIGGER trg_point_event_expiry
  BEFORE INSERT ON public.point_events
  FOR EACH ROW EXECUTE FUNCTION public.set_point_event_expiry();

CREATE OR REPLACE FUNCTION public.expire_old_points()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; _total INT := 0; _cur INT;
BEGIN
  FOR r IN
    SELECT user_id, SUM(points)::int AS pts
    FROM public.point_events
    WHERE points > 0 AND expired = false AND expires_at <= now()
    GROUP BY user_id
  LOOP
    SELECT total_points INTO _cur FROM public.user_points WHERE user_id = r.user_id FOR UPDATE;
    IF _cur IS NULL THEN CONTINUE; END IF;
    UPDATE public.user_points SET total_points = GREATEST(0, _cur - r.pts) WHERE user_id = r.user_id;
    INSERT INTO public.point_events (user_id, kind, points, description, metadata, expires_at, expired)
      VALUES (r.user_id, 'expired', -r.pts, 'Pontos expirados (12 meses)',
              jsonb_build_object('expired_count', r.pts), NULL, true);
    _total := _total + r.pts;
  END LOOP;
  UPDATE public.point_events SET expired = true
    WHERE points > 0 AND expired = false AND expires_at <= now();
  RETURN _total;
END; $$;

REVOKE EXECUTE ON FUNCTION public.expire_old_points() FROM PUBLIC, anon, authenticated;

DO $$ BEGIN PERFORM cron.unschedule('expire-points-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('expire-points-daily', '15 3 * * *', $$SELECT public.expire_old_points();$$);

CREATE OR REPLACE FUNCTION public.reverse_referral_on_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ref RECORD;
BEGIN
  IF NEW.status IN ('cancelled','refunded') AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT * INTO _ref FROM public.referrals
      WHERE referred_id = NEW.user_id AND status = 'confirmed' LIMIT 1;
    IF FOUND AND COALESCE(_ref.points_awarded, 0) > 0 THEN
      UPDATE public.user_points
        SET total_points = GREATEST(0, total_points - _ref.points_awarded)
        WHERE user_id = _ref.referrer_id;
      INSERT INTO public.point_events (user_id, kind, points, description, metadata)
        VALUES (_ref.referrer_id, 'refund_reversal', -_ref.points_awarded,
                'Estorno de indicação (assinatura cancelada)',
                jsonb_build_object('referral_id', _ref.id, 'subscription_id', NEW.id));
      UPDATE public.referrals SET status = 'cancelled' WHERE id = _ref.id;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_reverse_referral ON public.subscriptions;
CREATE TRIGGER trg_reverse_referral
  AFTER UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.reverse_referral_on_subscription();

CREATE OR REPLACE FUNCTION public.award_renewal_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _period TEXT; _pts INT; _prev_count INT; _rule_id TEXT;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  SELECT period INTO _period FROM public.plans WHERE id = NEW.plan_id;
  IF _period = 'monthly' THEN _rule_id := 'renewal_monthly';
  ELSIF _period = 'annual' THEN _rule_id := 'renewal_annual';
  ELSE RETURN NEW; END IF;

  SELECT count(*) INTO _prev_count FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.user_id = NEW.user_id AND s.id <> NEW.id AND p.period = _period;
  IF _prev_count = 0 THEN RETURN NEW; END IF;

  SELECT points INTO _pts FROM public.point_rules WHERE id = _rule_id AND active;
  IF COALESCE(_pts, 0) = 0 THEN RETURN NEW; END IF;

  UPDATE public.user_points SET total_points = total_points + _pts WHERE user_id = NEW.user_id;
  INSERT INTO public.point_events (user_id, kind, points, description, metadata)
    VALUES (NEW.user_id, _rule_id, _pts, 'Bônus de renovação',
            jsonb_build_object('subscription_id', NEW.id, 'plan_id', NEW.plan_id));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_award_renewal ON public.subscriptions;
CREATE TRIGGER trg_award_renewal
  AFTER INSERT ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.award_renewal_points();

CREATE OR REPLACE FUNCTION public.award_referral_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pts INT;
BEGIN
  SELECT points INTO _pts FROM public.point_rules WHERE id = 'referral_signup' AND active;
  IF COALESCE(_pts, 0) = 0 THEN RETURN NEW; END IF;
  UPDATE public.user_points SET total_points = total_points + _pts WHERE user_id = NEW.referrer_id;
  INSERT INTO public.point_events (user_id, kind, points, description, metadata)
    VALUES (NEW.referrer_id, 'referral_signup', _pts, 'Indicação cadastrada',
            jsonb_build_object('referral_id', NEW.id, 'referred_id', NEW.referred_id));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_award_referral_signup ON public.referrals;
CREATE TRIGGER trg_award_referral_signup
  AFTER INSERT ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.award_referral_signup();

REVOKE EXECUTE ON FUNCTION public.set_point_event_expiry() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reverse_referral_on_subscription() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_renewal_points() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_referral_signup() FROM PUBLIC, anon, authenticated;
