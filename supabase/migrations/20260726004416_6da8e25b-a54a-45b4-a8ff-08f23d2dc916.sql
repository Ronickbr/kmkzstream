-- Remove legacy unused overload callable by authenticated users
DROP FUNCTION IF EXISTS public.redeem_reward(uuid);

-- Referral code check is done server-side with service role; no direct client access needed
REVOKE ALL ON FUNCTION public.referral_code_exists(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.referral_code_exists(text) TO service_role;