
CREATE OR REPLACE FUNCTION public.award_referral_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
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

CREATE OR REPLACE FUNCTION public.confirm_referral_on_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE pts INTEGER; _referrer UUID;
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

DROP FUNCTION IF EXISTS public.active_plan_multiplier(uuid);
ALTER TABLE public.plans DROP COLUMN IF EXISTS points_multiplier;
