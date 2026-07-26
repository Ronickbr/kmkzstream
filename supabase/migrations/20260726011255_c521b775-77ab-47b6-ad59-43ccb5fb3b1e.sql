-- Exige sessão autenticada para ler as configurações de checkout
CREATE OR REPLACE FUNCTION public.get_checkout_settings()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _v jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT value INTO _v FROM public.app_settings WHERE key = 'payments';
  RETURN jsonb_build_object(
    'br_provider', COALESCE(_v->>'br_provider','infinitepay'),
    'intl_provider', COALESCE(_v->>'intl_provider','stripe'),
    'infinitepay', jsonb_build_object(
      'enabled', COALESCE((_v->'infinitepay'->>'enabled')::boolean, false),
      'handle', COALESCE(_v->'infinitepay'->>'handle',''),
      'redirect_url', COALESCE(_v->'infinitepay'->>'redirect_url','')
    ),
    'stripe', jsonb_build_object(
      'enabled', COALESCE((_v->'stripe'->>'enabled')::boolean, false),
      'payment_links', COALESCE(_v->'stripe'->'payment_links', '{}'::jsonb)
    )
  );
END; $function$;

-- Revoga acesso público/anônimo e concede apenas a usuários autenticados
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_settings(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_settings(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_award_achievements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.expiring_subscriptions(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_checkout_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_referrals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.growth_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_reminder_sent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid, jsonb) TO authenticated;