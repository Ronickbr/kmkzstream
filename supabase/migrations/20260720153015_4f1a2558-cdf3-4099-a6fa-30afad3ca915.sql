
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS points_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0
  CHECK (points_multiplier >= 1.0 AND points_multiplier <= 10.0);

-- Defaults sugeridos por período (só se ainda estiver em 1.0)
UPDATE public.plans SET points_multiplier = 1.25 WHERE period = 'quarterly' AND points_multiplier = 1.0;
UPDATE public.plans SET points_multiplier = 1.5  WHERE period = 'semiannual' AND points_multiplier = 1.0;
UPDATE public.plans SET points_multiplier = 2.0  WHERE period = 'annual' AND points_multiplier = 1.0;

-- Helper: multiplicador do plano ativo de um usuário (1.0 se não houver assinatura ativa)
CREATE OR REPLACE FUNCTION public.active_plan_multiplier(_user_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.points_multiplier
       FROM public.subscriptions s
       JOIN public.plans p ON p.id = s.plan_id
      WHERE s.user_id = _user_id AND s.status = 'active'
      ORDER BY s.starts_at DESC LIMIT 1),
    1.0
  );
$$;

-- Atualiza award_referral_signup para aplicar multiplicador do indicador
CREATE OR REPLACE FUNCTION public.award_referral_signup()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _pts INT; _mult NUMERIC; _final INT;
BEGIN
  SELECT points INTO _pts FROM public.point_rules WHERE id = 'referral_signup' AND active;
  IF COALESCE(_pts, 0) = 0 THEN RETURN NEW; END IF;
  _mult := public.active_plan_multiplier(NEW.referrer_id);
  _final := GREATEST(1, ROUND(_pts * _mult))::INT;
  UPDATE public.user_points SET total_points = total_points + _final WHERE user_id = NEW.referrer_id;
  INSERT INTO public.point_events (user_id, kind, points, description, metadata)
    VALUES (NEW.referrer_id, 'referral_signup', _final,
            'Indicação cadastrada' || CASE WHEN _mult > 1 THEN ' (x' || _mult || ')' ELSE '' END,
            jsonb_build_object('referral_id', NEW.id, 'referred_id', NEW.referred_id,
                               'base_points', _pts, 'multiplier', _mult));
  RETURN NEW;
END; $$;

-- Atualiza confirm_referral_on_subscription para aplicar multiplicador do indicador
CREATE OR REPLACE FUNCTION public.confirm_referral_on_subscription()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  pts INTEGER; _referrer UUID; _mult NUMERIC; _final INTEGER;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT referral_points INTO pts FROM public.plans WHERE id = NEW.plan_id;
    pts := COALESCE(pts, 0);
    SELECT r.referrer_id INTO _referrer FROM public.referrals r
      WHERE r.referred_id = NEW.user_id AND r.status = 'pending' LIMIT 1;
    _mult := COALESCE(public.active_plan_multiplier(_referrer), 1.0);
    _final := GREATEST(0, ROUND(pts * _mult))::INT;
    UPDATE public.referrals r
    SET status = 'confirmed', points_awarded = _final, confirmed_at = now()
    WHERE r.referred_id = NEW.user_id AND r.status = 'pending';
    IF _referrer IS NOT NULL AND _final > 0 THEN
      UPDATE public.user_points SET total_points = total_points + _final WHERE user_id = _referrer;
      INSERT INTO public.point_events (user_id, kind, points, description, metadata)
      VALUES (_referrer, 'referral_confirmed', _final,
              'Indicação confirmada' || CASE WHEN _mult > 1 THEN ' (x' || _mult || ')' ELSE '' END,
              jsonb_build_object('referred_id', NEW.user_id, 'plan_id', NEW.plan_id,
                                 'base_points', pts, 'multiplier', _mult));
    END IF;
  END IF;
  RETURN NEW;
END; $$;

GRANT EXECUTE ON FUNCTION public.active_plan_multiplier(uuid) TO authenticated;
