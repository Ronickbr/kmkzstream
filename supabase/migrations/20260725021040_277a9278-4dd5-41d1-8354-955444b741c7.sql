CREATE OR REPLACE FUNCTION public.award_renewal_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _period TEXT; _pts INT; _prev_count INT; _rule_id TEXT;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  SELECT period::text INTO _period FROM public.plans WHERE id = NEW.plan_id;
  IF _period = 'monthly' THEN _rule_id := 'renewal_monthly';
  ELSIF _period = 'annual' THEN _rule_id := 'renewal_annual';
  ELSE RETURN NEW; END IF;

  SELECT count(*) INTO _prev_count FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.user_id = NEW.user_id AND s.id <> NEW.id AND p.period::text = _period;
  IF _prev_count = 0 THEN RETURN NEW; END IF;

  SELECT points INTO _pts FROM public.point_rules WHERE id = _rule_id AND active;
  IF COALESCE(_pts, 0) = 0 THEN RETURN NEW; END IF;

  UPDATE public.user_points SET total_points = total_points + _pts WHERE user_id = NEW.user_id;
  INSERT INTO public.point_events (user_id, kind, points, description, metadata)
    VALUES (NEW.user_id, _rule_id, _pts, 'Bônus de renovação',
            jsonb_build_object('subscription_id', NEW.id, 'plan_id', NEW.plan_id));
  RETURN NEW;
END; $function$;