-- Confirma indicação apenas na PRIMEIRA compra paga do indicado
CREATE OR REPLACE FUNCTION public.confirm_referral_on_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE pts INTEGER; _ref RECORD; _prev INT;
BEGIN
  IF NEW.status <> 'active' OR COALESCE(NEW.payment_status,'') <> 'confirmed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.payment_status,'') = 'confirmed' THEN RETURN NEW; END IF;

  -- Somente a primeira compra confirmada do indicado gera pontos (renovações não)
  SELECT count(*) INTO _prev FROM public.subscriptions s
    WHERE s.user_id = NEW.user_id AND s.id <> NEW.id AND s.payment_status = 'confirmed';
  IF _prev > 0 THEN RETURN NEW; END IF;

  SELECT * INTO _ref FROM public.referrals r
    WHERE r.referred_id = NEW.user_id AND r.status = 'pending'
    FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT COALESCE(referral_points, 0) INTO pts FROM public.plans WHERE id = NEW.plan_id;
  pts := COALESCE(pts, 0);

  UPDATE public.referrals
     SET status = 'confirmed',
         points_awarded = pts,
         confirmed_at = now(),
         payment_id = COALESCE(NEW.payment_ref, NEW.id::text)
   WHERE id = _ref.id AND status = 'pending';

  IF pts > 0 THEN
    INSERT INTO public.point_events (user_id, kind, points, description, metadata)
    VALUES (_ref.referrer_id, 'referral_confirmed', pts, 'Indicação confirmada',
            jsonb_build_object('referral_id', _ref.id, 'referred_id', NEW.user_id,
                               'plan_id', NEW.plan_id, 'subscription_id', NEW.id,
                               'payment_id', COALESCE(NEW.payment_ref, NEW.id::text)));
    INSERT INTO public.user_points (user_id, total_points) VALUES (_ref.referrer_id, pts)
      ON CONFLICT (user_id) DO UPDATE SET total_points = public.user_points.total_points + EXCLUDED.total_points;
  END IF;
  RETURN NEW;
END; $function$;

-- Cancelamento/expiração/recusa/estorno: indicação permanece como está (pendente).
-- Apenas chargeback cancela a indicação e estorna os pontos.
CREATE OR REPLACE FUNCTION public.reverse_referral_on_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _ref RECORD;
BEGIN
  IF COALESCE(NEW.payment_status,'') <> 'chargeback'
     OR OLD.payment_status IS NOT DISTINCT FROM NEW.payment_status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _ref FROM public.referrals
    WHERE referred_id = NEW.user_id AND status = 'confirmed' LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF COALESCE(_ref.points_awarded, 0) > 0 THEN
    UPDATE public.user_points
      SET total_points = GREATEST(0, total_points - _ref.points_awarded)
      WHERE user_id = _ref.referrer_id;
    INSERT INTO public.point_events (user_id, kind, points, description, metadata)
      VALUES (_ref.referrer_id, 'refund_reversal', -_ref.points_awarded,
              'Estorno de indicação (chargeback)',
              jsonb_build_object('referral_id', _ref.id, 'subscription_id', NEW.id));
  END IF;

  UPDATE public.referrals
     SET status = 'canceled', points_awarded = 0, canceled_at = now()
   WHERE id = _ref.id;
  RETURN NEW;
END; $function$;

-- Conquista de divulgação: conta indicações registradas (não depende mais de pontos no cadastro)
CREATE OR REPLACE FUNCTION public.check_and_award_achievements()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user UUID := auth.uid();
  _ach RECORD; _type TEXT; _val INT; _current INT;
  _inserted UUID;
  _newly JSONB := '[]'::jsonb;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  FOR _ach IN
    SELECT a.* FROM public.achievements a
    WHERE a.active AND NOT EXISTS (
      SELECT 1 FROM public.user_achievements ua
      WHERE ua.user_id=_user AND ua.achievement_id=a.id
    )
    ORDER BY sort_order
  LOOP
    _type := _ach.criteria->>'type';
    _val := COALESCE((_ach.criteria->>'value')::int,1);
    _current := 0;

    IF _type = 'referrals_confirmed' THEN
      SELECT count(*) INTO _current FROM public.referrals WHERE referrer_id=_user AND status='confirmed';
    ELSIF _type = 'points_total' THEN
      SELECT COALESCE(total_points,0) INTO _current FROM public.user_points WHERE user_id=_user;
    ELSIF _type = 'share_count' THEN
      SELECT count(*) INTO _current FROM public.referrals WHERE referrer_id=_user;
    ELSIF _type = 'login_count' THEN
      SELECT 1 INTO _current;
    ELSIF _type = 'redemptions_count' THEN
      SELECT count(*) INTO _current FROM public.reward_redemptions WHERE user_id=_user;
    ELSIF _type = 'active_subscription' THEN
      SELECT CASE WHEN EXISTS(SELECT 1 FROM public.subscriptions WHERE user_id=_user AND status='active') THEN 1 ELSE 0 END INTO _current;
    END IF;

    IF _current >= _val THEN
      INSERT INTO public.user_achievements (user_id, achievement_id)
        VALUES (_user, _ach.id)
        ON CONFLICT DO NOTHING
        RETURNING user_id INTO _inserted;

      IF _inserted IS NOT NULL THEN
        IF _ach.points_reward > 0 THEN
          INSERT INTO public.point_events (user_id, kind, points, description, metadata)
            VALUES (_user,'achievement', _ach.points_reward, 'Conquista: ' || _ach.name,
                    jsonb_build_object('achievement_id', _ach.id))
            ON CONFLICT DO NOTHING;
          UPDATE public.user_points SET total_points = total_points + _ach.points_reward WHERE user_id=_user;
        END IF;
        _newly := _newly || jsonb_build_object('id',_ach.id,'name',_ach.name,'icon',_ach.icon,'points',_ach.points_reward);
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('unlocked', _newly);
END; $function$;

REVOKE EXECUTE ON FUNCTION public.confirm_referral_on_subscription() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reverse_referral_on_subscription() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_and_award_achievements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_award_achievements() TO authenticated;