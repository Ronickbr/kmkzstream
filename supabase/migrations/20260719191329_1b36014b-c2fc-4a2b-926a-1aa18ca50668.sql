
-- 1) Profiles policies cleanup
DROP POLICY IF EXISTS "Public can view profiles by referral code" ON public.profiles;
DROP POLICY IF EXISTS "Profiles readable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles visible to authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_authenticated" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can view profiles they referred"
  ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.referrals r
    WHERE r.referred_id = profiles.id AND r.referrer_id = auth.uid()
  ));

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) Revoke EXECUTE from anon on all SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.admin_analytics() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_stats() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.award_share_points() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_and_award_achievements() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_daily_login() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.growth_metrics() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.leaderboard(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_reward(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_reward(uuid, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM anon, PUBLIC;

-- 3) Revoke EXECUTE from authenticated on trigger-only / internal functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_referral_on_subscription() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_achievement_unlocked() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_redemption_status() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_referral_confirmed() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_subscription_active() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_welcome() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM authenticated;
