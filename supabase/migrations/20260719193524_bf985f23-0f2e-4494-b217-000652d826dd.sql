
-- Deny direct client writes on tables written only via SECURITY DEFINER functions
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['point_events','reward_redemptions','user_achievements','user_points']
  LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- point_events: block direct writes via RLS
DROP POLICY IF EXISTS "No direct inserts on point_events" ON public.point_events;
CREATE POLICY "No direct inserts on point_events" ON public.point_events
  FOR INSERT TO anon, authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "No direct updates on point_events" ON public.point_events;
CREATE POLICY "No direct updates on point_events" ON public.point_events
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "No direct deletes on point_events" ON public.point_events;
CREATE POLICY "No direct deletes on point_events" ON public.point_events
  FOR DELETE TO anon, authenticated USING (false);

-- reward_redemptions: block direct writes (created via redeem_reward RPC)
DROP POLICY IF EXISTS "No direct inserts on reward_redemptions" ON public.reward_redemptions;
CREATE POLICY "No direct inserts on reward_redemptions" ON public.reward_redemptions
  FOR INSERT TO anon, authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "No direct updates on reward_redemptions" ON public.reward_redemptions;
CREATE POLICY "No direct updates on reward_redemptions" ON public.reward_redemptions
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "No direct deletes on reward_redemptions" ON public.reward_redemptions;
CREATE POLICY "No direct deletes on reward_redemptions" ON public.reward_redemptions
  FOR DELETE TO anon, authenticated USING (false);

-- user_achievements: block direct writes (awarded by check_and_award_achievements)
DROP POLICY IF EXISTS "No direct inserts on user_achievements" ON public.user_achievements;
CREATE POLICY "No direct inserts on user_achievements" ON public.user_achievements
  FOR INSERT TO anon, authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "No direct updates on user_achievements" ON public.user_achievements;
CREATE POLICY "No direct updates on user_achievements" ON public.user_achievements
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "No direct deletes on user_achievements" ON public.user_achievements;
CREATE POLICY "No direct deletes on user_achievements" ON public.user_achievements
  FOR DELETE TO anon, authenticated USING (false);

-- user_points: block direct writes (managed by triggers/RPCs)
DROP POLICY IF EXISTS "No direct inserts on user_points" ON public.user_points;
CREATE POLICY "No direct inserts on user_points" ON public.user_points
  FOR INSERT TO anon, authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "No direct updates on user_points" ON public.user_points;
CREATE POLICY "No direct updates on user_points" ON public.user_points
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "No direct deletes on user_points" ON public.user_points;
CREATE POLICY "No direct deletes on user_points" ON public.user_points
  FOR DELETE TO anon, authenticated USING (false);

-- Revoke EXECUTE on privileged SECURITY DEFINER functions from anon and authenticated.
-- These are triggers or admin-only; callers use server-side paths (triggers, admin RPCs).
REVOKE EXECUTE ON FUNCTION public.admin_stats() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_analytics() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.growth_metrics() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_welcome() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_redemption_status() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_subscription_active() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_referral_confirmed() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_achievement_unlocked() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_referral_on_subscription() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM anon, authenticated, PUBLIC;

-- Grant admin-only RPCs back to authenticated (they self-check has_role internally)
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.growth_metrics() TO authenticated;

-- User-callable RPCs need authenticated EXECUTE (they self-check auth.uid())
GRANT EXECUTE ON FUNCTION public.claim_daily_login() TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_share_points() TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_award_achievements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
