
CREATE OR REPLACE FUNCTION public.admin_analytics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _plan_dist jsonb;
  _top_users jsonb;
  _referral_funnel jsonb;
  _redemption_funnel jsonb;
  _daily_signups jsonb;
  _active_30d INT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT jsonb_agg(row_to_json(t)) INTO _plan_dist FROM (
    SELECT p.name, p.period, COUNT(s.id)::int AS count
    FROM public.plans p
    LEFT JOIN public.subscriptions s ON s.plan_id = p.id AND s.status = 'active'
    GROUP BY p.id, p.name, p.period, p.sort_order
    ORDER BY p.sort_order
  ) t;

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.total_points DESC) INTO _top_users FROM (
    SELECT p.display_name, up.total_points,
      (SELECT COUNT(*) FROM public.referrals r WHERE r.referrer_id = p.id AND r.status='confirmed')::int AS referrals
    FROM public.profiles p
    JOIN public.user_points up ON up.user_id = p.id
    ORDER BY up.total_points DESC
    LIMIT 10
  ) t;

  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM public.referrals)::int,
    'pending', (SELECT COUNT(*) FROM public.referrals WHERE status='pending')::int,
    'confirmed', (SELECT COUNT(*) FROM public.referrals WHERE status='confirmed')::int,
    'conversion_rate', CASE
      WHEN (SELECT COUNT(*) FROM public.referrals) = 0 THEN 0
      ELSE ROUND(100.0 * (SELECT COUNT(*) FROM public.referrals WHERE status='confirmed')
        / (SELECT COUNT(*) FROM public.referrals), 1)
    END
  ) INTO _referral_funnel;

  SELECT jsonb_build_object(
    'pending', (SELECT COUNT(*) FROM public.reward_redemptions WHERE status='pending')::int,
    'fulfilled', (SELECT COUNT(*) FROM public.reward_redemptions WHERE status='fulfilled')::int,
    'cancelled', (SELECT COUNT(*) FROM public.reward_redemptions WHERE status='cancelled')::int,
    'points_spent', (SELECT COALESCE(SUM(points_spent),0) FROM public.reward_redemptions WHERE status IN ('fulfilled','pending'))::int
  ) INTO _redemption_funnel;

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.day) INTO _daily_signups FROM (
    SELECT to_char(gs, 'YYYY-MM-DD') AS day,
      (SELECT COUNT(*) FROM public.profiles p WHERE p.created_at::date = gs::date)::int AS signups
    FROM generate_series((now() - INTERVAL '29 days')::date, now()::date, INTERVAL '1 day') gs
  ) t;

  SELECT COUNT(DISTINCT user_id)::int INTO _active_30d
    FROM public.point_events
    WHERE created_at >= now() - INTERVAL '30 days';

  RETURN jsonb_build_object(
    'plan_distribution', COALESCE(_plan_dist,'[]'::jsonb),
    'top_users', COALESCE(_top_users,'[]'::jsonb),
    'referral_funnel', _referral_funnel,
    'redemption_funnel', _redemption_funnel,
    'daily_signups', COALESCE(_daily_signups,'[]'::jsonb),
    'active_users_30d', _active_30d
  );
END;
$$;
