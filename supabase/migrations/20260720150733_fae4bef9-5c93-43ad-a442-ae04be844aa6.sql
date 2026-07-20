
-- Lock down SECURITY DEFINER functions: revoke EXECUTE from PUBLIC/anon/authenticated,
-- then re-grant only to the roles that legitimately call each function.
-- Trigger-only functions do not need any grant (triggers run in the definer's context).

-- Trigger-only functions
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_redemption_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_subscription_active() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_welcome() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_achievement_unlocked() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_referral_confirmed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_point_event_expiry() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_referral_signup() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_renewal_points() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_purchase_points() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_referral_on_subscription() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_referral_on_subscription() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_old_points() FROM PUBLIC, anon, authenticated;

-- Admin-only RPCs (function performs has_role check internally)
REVOKE ALL ON FUNCTION public.admin_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_analytics() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.growth_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.growth_metrics() TO authenticated;

-- User RPCs (authenticated only)
REVOKE ALL ON FUNCTION public.redeem_reward(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_reward(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_and_award_achievements() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leaderboard(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_award_achievements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard(text) TO authenticated;

-- has_role is intentionally callable by anon+authenticated because it is used by
-- RLS policies and by public landing-page queries. Keep grants explicit.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
