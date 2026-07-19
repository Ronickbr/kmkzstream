-- Restore EXECUTE on has_role for authenticated users; RLS policies depend on it.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Also needed for admin-invoked RPCs called by signed-in admins
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.growth_metrics() TO authenticated;