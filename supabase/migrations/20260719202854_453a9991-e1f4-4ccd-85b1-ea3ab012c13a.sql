-- Drop daily login RPC
DROP FUNCTION IF EXISTS public.claim_daily_login();

-- Remove daily login point rule
DELETE FROM public.point_rules WHERE id = 'daily_login';

-- Remove streak-based achievements
DELETE FROM public.user_achievements
  WHERE achievement_id IN (SELECT id FROM public.achievements WHERE criteria->>'type' = 'streak');
DELETE FROM public.achievements WHERE criteria->>'type' = 'streak';