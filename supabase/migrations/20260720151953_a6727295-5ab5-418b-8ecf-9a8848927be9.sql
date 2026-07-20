
-- 1. Referrer PII exposure: drop broad profile access, replace with narrow RPC
DROP POLICY IF EXISTS "Users can view profiles they referred" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_my_referrals()
RETURNS TABLE (
  id uuid,
  status referral_status,
  points_awarded integer,
  confirmed_at timestamptz,
  created_at timestamptz,
  referred_display_name text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.status, r.points_awarded, r.confirmed_at, r.created_at,
         p.display_name AS referred_display_name
  FROM public.referrals r
  LEFT JOIN public.profiles p ON p.id = r.referred_id
  WHERE r.referrer_id = auth.uid()
  ORDER BY r.created_at DESC
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_referrals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_referrals() TO authenticated;

-- 2. Anti-farming: prevent creating a new active subscription while a paid period is still valid
CREATE OR REPLACE FUNCTION public.prevent_subscription_farming()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing INT;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT count(*) INTO _existing
    FROM public.subscriptions
    WHERE user_id = NEW.user_id
      AND id <> NEW.id
      AND ends_at IS NOT NULL
      AND ends_at > now();
    IF _existing > 0 THEN
      RAISE EXCEPTION 'active_period_not_ended'
        USING HINT = 'Você já possui um período pago em vigor. Aguarde o término antes de contratar novamente.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_subscription_farming ON public.subscriptions;
CREATE TRIGGER trg_prevent_subscription_farming
  BEFORE INSERT ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_subscription_farming();
