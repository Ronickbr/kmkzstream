
CREATE TABLE public.point_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  daily_limit INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.point_rules TO authenticated;
GRANT ALL ON public.point_rules TO service_role;
ALTER TABLE public.point_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rules_read_auth" ON public.point_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "rules_admin_write" ON public.point_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.point_rules (id, name, points, daily_limit) VALUES
  ('daily_login', 'Login diário', 5, 1),
  ('share', 'Compartilhar link de indicação', 2, 5),
  ('referral_confirmed', 'Indicação confirmada (plano)', 0, NULL),
  ('reward_redeemed', 'Resgate de prêmio', 0, NULL);

CREATE TABLE public.point_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  points INTEGER NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX point_events_user_created ON public.point_events (user_id, created_at DESC);
CREATE INDEX point_events_user_kind_created ON public.point_events (user_id, kind, created_at DESC);
GRANT SELECT ON public.point_events TO authenticated;
GRANT ALL ON public.point_events TO service_role;
ALTER TABLE public.point_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_own_read" ON public.point_events FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "events_admin_read" ON public.point_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.claim_daily_login()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user UUID := auth.uid();
  _pts INTEGER; _limit INTEGER; _count INTEGER;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT points, COALESCE(daily_limit, 1) INTO _pts, _limit
    FROM public.point_rules WHERE id = 'daily_login' AND active;
  IF _pts IS NULL THEN RAISE EXCEPTION 'rule_inactive'; END IF;
  SELECT count(*) INTO _count FROM public.point_events
    WHERE user_id = _user AND kind = 'daily_login'
      AND created_at >= date_trunc('day', now())
      AND created_at <  date_trunc('day', now()) + INTERVAL '1 day';
  IF _count >= _limit THEN RAISE EXCEPTION 'already_claimed_today'; END IF;
  INSERT INTO public.point_events (user_id, kind, points, description)
    VALUES (_user, 'daily_login', _pts, 'Login diário');
  UPDATE public.user_points SET total_points = total_points + _pts WHERE user_id = _user;
  RETURN jsonb_build_object('points', _pts);
END; $$;

CREATE OR REPLACE FUNCTION public.award_share_points()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user UUID := auth.uid();
  _pts INTEGER; _limit INTEGER; _count INTEGER;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT points, COALESCE(daily_limit, 5) INTO _pts, _limit
    FROM public.point_rules WHERE id = 'share' AND active;
  IF _pts IS NULL THEN RAISE EXCEPTION 'rule_inactive'; END IF;
  SELECT count(*) INTO _count FROM public.point_events
    WHERE user_id = _user AND kind = 'share'
      AND created_at >= date_trunc('day', now())
      AND created_at <  date_trunc('day', now()) + INTERVAL '1 day';
  IF _count >= _limit THEN RAISE EXCEPTION 'daily_limit_reached'; END IF;
  INSERT INTO public.point_events (user_id, kind, points, description)
    VALUES (_user, 'share', _pts, 'Compartilhamento do link');
  UPDATE public.user_points SET total_points = total_points + _pts WHERE user_id = _user;
  RETURN jsonb_build_object('points', _pts, 'remaining', _limit - _count - 1);
END; $$;

CREATE OR REPLACE FUNCTION public.confirm_referral_on_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pts INTEGER; _referrer UUID;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT referral_points INTO pts FROM public.plans WHERE id = NEW.plan_id;
    pts := COALESCE(pts, 0);
    SELECT r.referrer_id INTO _referrer FROM public.referrals r
      WHERE r.referred_id = NEW.user_id AND r.status = 'pending' LIMIT 1;
    UPDATE public.referrals r
    SET status = 'confirmed', points_awarded = pts, confirmed_at = now()
    WHERE r.referred_id = NEW.user_id AND r.status = 'pending';
    IF _referrer IS NOT NULL AND pts > 0 THEN
      UPDATE public.user_points SET total_points = total_points + pts WHERE user_id = _referrer;
      INSERT INTO public.point_events (user_id, kind, points, description, metadata)
      VALUES (_referrer, 'referral_confirmed', pts, 'Indicação confirmada',
              jsonb_build_object('referred_id', NEW.user_id, 'plan_id', NEW.plan_id));
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.redeem_reward(_reward_id uuid, _shipping jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user UUID := auth.uid();
  _cost INTEGER; _stock INTEGER; _active BOOLEAN;
  _kind TEXT; _months INTEGER; _balance INTEGER; _name TEXT;
  _redemption_id UUID; _sub_id UUID; _sub_end TIMESTAMPTZ;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT points_cost, stock, active, kind, subscription_months, name
    INTO _cost, _stock, _active, _kind, _months, _name
  FROM public.rewards WHERE id = _reward_id FOR UPDATE;
  IF _cost IS NULL THEN RAISE EXCEPTION 'reward_not_found'; END IF;
  IF NOT _active THEN RAISE EXCEPTION 'reward_inactive'; END IF;
  IF _stock <= 0 THEN RAISE EXCEPTION 'reward_out_of_stock'; END IF;
  IF _kind = 'device' THEN
    IF _shipping IS NULL OR COALESCE(_shipping->>'recipient','')=''
       OR COALESCE(_shipping->>'address','')='' OR COALESCE(_shipping->>'city','')=''
       OR COALESCE(_shipping->>'state','')='' OR COALESCE(_shipping->>'zip','')='' THEN
      RAISE EXCEPTION 'shipping_required';
    END IF;
  END IF;
  SELECT total_points INTO _balance FROM public.user_points WHERE user_id = _user FOR UPDATE;
  IF _balance IS NULL OR _balance < _cost THEN RAISE EXCEPTION 'insufficient_points'; END IF;
  UPDATE public.user_points SET total_points = total_points - _cost WHERE user_id = _user;
  UPDATE public.rewards SET stock = stock - 1 WHERE id = _reward_id;
  INSERT INTO public.reward_redemptions (
    user_id, reward_id, points_spent, status,
    shipping_recipient, shipping_address, shipping_city, shipping_state, shipping_zip, shipping_phone, shipping_notes
  ) VALUES (
    _user, _reward_id, _cost,
    CASE WHEN _kind='subscription' THEN 'fulfilled'::redemption_status ELSE 'pending'::redemption_status END,
    _shipping->>'recipient', _shipping->>'address', _shipping->>'city',
    _shipping->>'state', _shipping->>'zip', _shipping->>'phone', _shipping->>'notes'
  ) RETURNING id INTO _redemption_id;
  INSERT INTO public.point_events (user_id, kind, points, description, metadata)
  VALUES (_user, 'reward_redeemed', -_cost, 'Resgate: ' || _name,
          jsonb_build_object('reward_id', _reward_id, 'redemption_id', _redemption_id));
  IF _kind = 'subscription' AND COALESCE(_months,0) > 0 THEN
    SELECT id, ends_at INTO _sub_id, _sub_end
    FROM public.subscriptions WHERE user_id = _user AND status = 'active'
    ORDER BY ends_at DESC NULLS LAST LIMIT 1;
    IF _sub_id IS NOT NULL THEN
      UPDATE public.subscriptions
      SET ends_at = GREATEST(COALESCE(_sub_end, now()), now()) + (_months || ' months')::interval
      WHERE id = _sub_id;
    END IF;
  END IF;
  RETURN _redemption_id;
END; $$;

CREATE OR REPLACE FUNCTION public.growth_metrics()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _months jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.month) INTO _months FROM (
    SELECT
      to_char(gs, 'YYYY-MM') AS month,
      (SELECT COUNT(*) FROM public.profiles p
        WHERE date_trunc('month', p.created_at) = gs) AS new_users,
      (SELECT COUNT(*) FROM public.subscriptions s
        WHERE date_trunc('month', s.started_at) = gs) AS new_subscriptions,
      (SELECT COALESCE(SUM(pl.price_cents),0) FROM public.subscriptions s
        JOIN public.plans pl ON pl.id = s.plan_id
        WHERE date_trunc('month', s.started_at) = gs) AS revenue_cents
    FROM generate_series(
      date_trunc('month', now()) - INTERVAL '5 months',
      date_trunc('month', now()),
      INTERVAL '1 month'
    ) gs
  ) t;
  RETURN jsonb_build_object(
    'months', COALESCE(_months, '[]'::jsonb),
    'mrr_cents', (SELECT COALESCE(SUM(pl.price_cents),0)
                    FROM public.subscriptions s JOIN public.plans pl ON pl.id = s.plan_id
                    WHERE s.status = 'active'),
    'total_points_outstanding', (SELECT COALESCE(SUM(total_points),0) FROM public.user_points),
    'total_points_awarded', (SELECT COALESCE(SUM(points),0) FROM public.point_events WHERE points > 0)
  );
END; $$;

CREATE TRIGGER point_rules_updated_at BEFORE UPDATE ON public.point_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
