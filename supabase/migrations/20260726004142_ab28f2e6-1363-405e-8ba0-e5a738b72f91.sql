REVOKE EXECUTE ON FUNCTION public.referral_code_exists(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.referral_code_exists(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.referral_code_exists(text) TO authenticated, service_role;