
-- 1) Dedup existing duplicate achievement point_events and refund overcounted points
WITH ranked AS (
  SELECT id, user_id, points,
    ROW_NUMBER() OVER (PARTITION BY user_id, kind, (metadata->>'achievement_id') ORDER BY created_at) AS rn
  FROM public.point_events
  WHERE kind = 'achievement' AND metadata ? 'achievement_id'
),
extras AS (
  SELECT * FROM ranked WHERE rn > 1
),
refunds AS (
  SELECT user_id, SUM(points)::int AS pts FROM extras GROUP BY user_id
),
del AS (
  DELETE FROM public.point_events WHERE id IN (SELECT id FROM extras) RETURNING 1
)
UPDATE public.user_points up
SET total_points = GREATEST(0, up.total_points - r.pts)
FROM refunds r WHERE up.user_id = r.user_id;

-- 2) Dedup existing share point_events (all previous 'share' events invalidated;
--    share points now only awarded when someone signs up via the referral link)
WITH share_totals AS (
  SELECT user_id, SUM(points)::int AS pts
  FROM public.point_events WHERE kind = 'share' AND points > 0
  GROUP BY user_id
),
del AS (
  DELETE FROM public.point_events WHERE kind = 'share' RETURNING 1
)
UPDATE public.user_points up
SET total_points = GREATEST(0, up.total_points - st.pts)
FROM share_totals st WHERE up.user_id = st.user_id;

-- 3) Add unique constraint to prevent duplicate achievement point events
CREATE UNIQUE INDEX IF NOT EXISTS point_events_unique_achievement
  ON public.point_events (user_id, (metadata->>'achievement_id'))
  WHERE kind = 'achievement';

-- 4) Fix check_and_award_achievements: only award points when the achievement
--    was actually inserted (guards against concurrent duplicate awards)
CREATE OR REPLACE FUNCTION public.check_and_award_achievements()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user UUID := auth.uid();
  _ach RECORD; _type TEXT; _val INT; _current INT;
  _inserted UUID;
  _newly JSONB := '[]'::jsonb;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  FOR _ach IN
    SELECT a.* FROM public.achievements a
    WHERE a.active AND NOT EXISTS (
      SELECT 1 FROM public.user_achievements ua
      WHERE ua.user_id=_user AND ua.achievement_id=a.id
    )
    ORDER BY sort_order
  LOOP
    _type := _ach.criteria->>'type';
    _val := COALESCE((_ach.criteria->>'value')::int,1);
    _current := 0;

    IF _type = 'referrals_confirmed' THEN
      SELECT count(*) INTO _current FROM public.referrals WHERE referrer_id=_user AND status='confirmed';
    ELSIF _type = 'points_total' THEN
      SELECT COALESCE(total_points,0) INTO _current FROM public.user_points WHERE user_id=_user;
    ELSIF _type = 'share_count' THEN
      SELECT count(*) INTO _current FROM public.point_events WHERE user_id=_user AND kind='referral_signup';
    ELSIF _type = 'login_count' THEN
      SELECT 1 INTO _current;
    ELSIF _type = 'redemptions_count' THEN
      SELECT count(*) INTO _current FROM public.reward_redemptions WHERE user_id=_user;
    ELSIF _type = 'active_subscription' THEN
      SELECT CASE WHEN EXISTS(SELECT 1 FROM public.subscriptions WHERE user_id=_user AND status='active') THEN 1 ELSE 0 END INTO _current;
    END IF;

    IF _current >= _val THEN
      -- Only proceed if we actually inserted (no prior award)
      INSERT INTO public.user_achievements (user_id, achievement_id)
        VALUES (_user, _ach.id)
        ON CONFLICT DO NOTHING
        RETURNING user_id INTO _inserted;

      IF _inserted IS NOT NULL THEN
        IF _ach.points_reward > 0 THEN
          -- Guarded by unique index on (user_id, achievement_id) where kind='achievement'
          INSERT INTO public.point_events (user_id, kind, points, description, metadata)
            VALUES (_user,'achievement', _ach.points_reward, 'Conquista: ' || _ach.name,
                    jsonb_build_object('achievement_id', _ach.id))
            ON CONFLICT DO NOTHING;
          UPDATE public.user_points SET total_points = total_points + _ach.points_reward WHERE user_id=_user;
        END IF;
        _newly := _newly || jsonb_build_object('id',_ach.id,'name',_ach.name,'icon',_ach.icon,'points',_ach.points_reward);
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('unlocked', _newly);
END; $function$;

-- 5) Remove manual share point award - share only rewards when someone signs up via link
DROP FUNCTION IF EXISTS public.award_share_points();

-- 6) Disable/replace the 'share' point rule and ensure referral_signup rule exists
UPDATE public.point_rules SET active = false WHERE id = 'share';

INSERT INTO public.point_rules (id, name, points, daily_limit, active)
VALUES ('referral_signup', 'Cadastro por indicação', 10, NULL, true)
ON CONFLICT (id) DO UPDATE SET active = true;
