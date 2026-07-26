-- 1) Assinaturas nascem pendentes de pagamento
ALTER TABLE public.subscriptions ALTER COLUMN payment_status SET DEFAULT 'pending';

-- 2) Impede pontos duplicados por assinatura
CREATE UNIQUE INDEX IF NOT EXISTS point_events_unique_subscription_kind
  ON public.point_events (user_id, kind, ((metadata->>'subscription_id')))
  WHERE kind IN ('purchase','renewal_monthly','renewal_annual');

-- 3) Pontos de compra somente com pagamento confirmado
CREATE OR REPLACE FUNCTION public.award_purchase_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _pts INT; _prev_count INT;
BEGIN
  IF NEW.status <> 'active' OR COALESCE(NEW.payment_status,'') <> 'confirmed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.payment_status,'') = 'confirmed' AND OLD.status = 'active' THEN RETURN NEW; END IF;

  SELECT count(*) INTO _prev_count FROM public.subscriptions s
    WHERE s.user_id = NEW.user_id AND s.id <> NEW.id AND s.payment_status = 'confirmed';
  IF _prev_count > 0 THEN RETURN NEW; END IF;

  SELECT COALESCE(purchase_points, 0) INTO _pts FROM public.plans WHERE id = NEW.plan_id;
  IF COALESCE(_pts, 0) <= 0 THEN RETURN NEW; END IF;

  BEGIN
    INSERT INTO public.point_events (user_id, kind, points, description, metadata, expires_at)
      VALUES (NEW.user_id, 'purchase', _pts, 'Pontos por aquisição de plano',
              jsonb_build_object('subscription_id', NEW.id, 'plan_id', NEW.plan_id),
              now() + interval '12 months');
  EXCEPTION WHEN unique_violation THEN
    RETURN NEW;
  END;

  INSERT INTO public.user_points (user_id, total_points)
    VALUES (NEW.user_id, _pts)
    ON CONFLICT (user_id) DO UPDATE SET total_points = public.user_points.total_points + EXCLUDED.total_points;
  RETURN NEW;
END; $function$;

-- 4) Pontos de renovação somente com pagamento confirmado
CREATE OR REPLACE FUNCTION public.award_renewal_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _period TEXT; _pts INT; _prev_count INT; _rule_id TEXT;
BEGIN
  IF NEW.status <> 'active' OR COALESCE(NEW.payment_status,'') <> 'confirmed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.payment_status,'') = 'confirmed' AND OLD.status = 'active' THEN RETURN NEW; END IF;

  SELECT period::text INTO _period FROM public.plans WHERE id = NEW.plan_id;
  IF _period = 'monthly' THEN _rule_id := 'renewal_monthly';
  ELSIF _period = 'annual' THEN _rule_id := 'renewal_annual';
  ELSE RETURN NEW; END IF;

  SELECT count(*) INTO _prev_count FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.user_id = NEW.user_id AND s.id <> NEW.id
      AND s.payment_status = 'confirmed' AND p.period::text = _period;
  IF _prev_count = 0 THEN RETURN NEW; END IF;

  SELECT points INTO _pts FROM public.point_rules WHERE id = _rule_id AND active;
  IF COALESCE(_pts, 0) = 0 THEN RETURN NEW; END IF;

  BEGIN
    INSERT INTO public.point_events (user_id, kind, points, description, metadata)
      VALUES (NEW.user_id, _rule_id, _pts, 'Bônus de renovação',
              jsonb_build_object('subscription_id', NEW.id, 'plan_id', NEW.plan_id));
  EXCEPTION WHEN unique_violation THEN
    RETURN NEW;
  END;

  UPDATE public.user_points SET total_points = total_points + _pts WHERE user_id = NEW.user_id;
  RETURN NEW;
END; $function$;

-- 5) Indicação só é confirmada com pagamento confirmado
CREATE OR REPLACE FUNCTION public.confirm_referral_on_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE pts INTEGER; _referrer UUID;
BEGIN
  IF NEW.status <> 'active' OR COALESCE(NEW.payment_status,'') <> 'confirmed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.payment_status,'') = 'confirmed' AND OLD.status = 'active' THEN RETURN NEW; END IF;

  SELECT referral_points INTO pts FROM public.plans WHERE id = NEW.plan_id;
  pts := COALESCE(pts, 0);
  SELECT r.referrer_id INTO _referrer FROM public.referrals r
    WHERE r.referred_id = NEW.user_id AND r.status = 'pending' LIMIT 1;
  IF _referrer IS NULL THEN RETURN NEW; END IF;

  UPDATE public.referrals r
  SET status = 'confirmed', points_awarded = pts, confirmed_at = now()
  WHERE r.referred_id = NEW.user_id AND r.status = 'pending';

  IF pts > 0 THEN
    UPDATE public.user_points SET total_points = total_points + pts WHERE user_id = _referrer;
    INSERT INTO public.point_events (user_id, kind, points, description, metadata)
    VALUES (_referrer, 'referral_confirmed', pts, 'Indicação confirmada',
            jsonb_build_object('referred_id', NEW.user_id, 'plan_id', NEW.plan_id, 'subscription_id', NEW.id));
  END IF;
  RETURN NEW;
END; $function$;

-- 6) Estorno de indicação com os status reais do sistema
CREATE OR REPLACE FUNCTION public.reverse_referral_on_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _ref RECORD;
BEGIN
  IF (NEW.status IN ('canceled','expired') OR COALESCE(NEW.payment_status,'') IN ('failed','refunded'))
     AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.payment_status IS DISTINCT FROM NEW.payment_status) THEN
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
      UPDATE public.referrals
        SET status = 'pending', points_awarded = 0, confirmed_at = NULL
        WHERE id = _ref.id;
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

-- 7) Trava anti-farming considera apenas períodos pagos
CREATE OR REPLACE FUNCTION public.prevent_subscription_farming()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _existing INT;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT count(*) INTO _existing
    FROM public.subscriptions
    WHERE user_id = NEW.user_id
      AND id <> NEW.id
      AND payment_status = 'confirmed'
      AND ends_at IS NOT NULL
      AND ends_at > now();
    IF _existing > 0 THEN
      RAISE EXCEPTION 'active_period_not_ended'
        USING HINT = 'Você já possui um período pago em vigor. Aguarde o término antes de contratar novamente.';
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

-- 8) Gatilhos passam a valer também na confirmação posterior do pagamento
DROP TRIGGER IF EXISTS trg_award_purchase_points ON public.subscriptions;
CREATE TRIGGER trg_award_purchase_points
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.award_purchase_points();

DROP TRIGGER IF EXISTS trg_award_renewal ON public.subscriptions;
CREATE TRIGGER trg_award_renewal
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.award_renewal_points();

DROP TRIGGER IF EXISTS on_subscription_created_confirm_referral ON public.subscriptions;
CREATE TRIGGER on_subscription_created_confirm_referral
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.confirm_referral_on_subscription();