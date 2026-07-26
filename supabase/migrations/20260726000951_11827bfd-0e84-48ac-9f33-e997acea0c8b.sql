
REVOKE ALL ON FUNCTION public.audit_subscriptions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_point_events() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_user_roles() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_reward_redemptions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_profiles() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_app_settings() FROM PUBLIC, anon, authenticated;
