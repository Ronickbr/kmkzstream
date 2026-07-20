CREATE OR REPLACE FUNCTION public.award_purchase_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _pts INT; _prev_count INT;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;

  -- Only award purchase points on the user's FIRST subscription ever.
  -- Subsequent subscriptions are handled by award_renewal_points.
  SELECT count(*) INTO _prev_count FROM public.subscriptions s
    WHERE s.user_id = NEW.user_id AND s.id <> NEW.id;
  IF _prev_count > 0 THEN RETURN NEW; END IF;

  SELECT COALESCE(purchase_points, 0) INTO _pts FROM public.plans WHERE id = NEW.plan_id;
  IF COALESCE(_pts, 0) <= 0 THEN RETURN NEW; END IF;

  INSERT INTO public.user_points (user_id, total_points)
    VALUES (NEW.user_id, _pts)
    ON CONFLICT (user_id) DO UPDATE SET total_points = public.user_points.total_points + EXCLUDED.total_points;

  INSERT INTO public.point_events (user_id, kind, points, description, metadata, expires_at)
    VALUES (NEW.user_id, 'purchase', _pts, 'Pontos por aquisição de plano',
            jsonb_build_object('subscription_id', NEW.id, 'plan_id', NEW.plan_id),
            now() + interval '12 months');
  RETURN NEW;
END; $function$;