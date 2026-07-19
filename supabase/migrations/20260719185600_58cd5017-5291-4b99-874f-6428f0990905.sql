
ALTER TABLE public.user_points
  ADD COLUMN IF NOT EXISTS current_streak INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login_date DATE;

CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'trophy',
  category TEXT NOT NULL DEFAULT 'general',
  points_reward INT NOT NULL DEFAULT 0,
  criteria JSONB NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "achievements_read" ON public.achievements;
CREATE POLICY "achievements_read" ON public.achievements FOR SELECT TO authenticated USING (active);
DROP POLICY IF EXISTS "achievements_admin" ON public.achievements;
CREATE POLICY "achievements_admin" ON public.achievements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);
GRANT SELECT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_achievements" ON public.user_achievements;
CREATE POLICY "own_achievements" ON public.user_achievements FOR SELECT TO authenticated USING (auth.uid() = user_id);

INSERT INTO public.achievements (id, name, description, icon, category, points_reward, criteria, sort_order) VALUES
  ('first_login','Primeiro Acesso','Entrou no KMKZ pela primeira vez','sparkles','onboarding',10,'{"type":"login_count","value":1}'::jsonb,1),
  ('first_share','Divulgador','Compartilhou seu link de indicação','share','referral',15,'{"type":"share_count","value":1}'::jsonb,2),
  ('first_referral','Padrinho','Confirmou sua primeira indicação','users','referral',50,'{"type":"referrals_confirmed","value":1}'::jsonb,3),
  ('referrer_5','Influenciador','5 indicações confirmadas','users','referral',150,'{"type":"referrals_confirmed","value":5}'::jsonb,4),
  ('referrer_10','Embaixador KMKZ','10 indicações confirmadas','crown','referral',300,'{"type":"referrals_confirmed","value":10}'::jsonb,5),
  ('referrer_25','Lenda das Indicações','25 indicações confirmadas','crown','referral',800,'{"type":"referrals_confirmed","value":25}'::jsonb,6),
  ('streak_3','Consistente','Login diário por 3 dias','flame','streak',30,'{"type":"streak","value":3}'::jsonb,10),
  ('streak_7','Semana Perfeita','Login diário por 7 dias','flame','streak',80,'{"type":"streak","value":7}'::jsonb,11),
  ('streak_30','Mês em Chamas','Login diário por 30 dias','flame','streak',400,'{"type":"streak","value":30}'::jsonb,12),
  ('points_500','Colecionador','Acumulou 500 pontos','gem','points',20,'{"type":"points_total","value":500}'::jsonb,20),
  ('points_2000','Elite','Acumulou 2000 pontos','gem','points',100,'{"type":"points_total","value":2000}'::jsonb,21),
  ('points_10000','Master','Acumulou 10.000 pontos','gem','points',500,'{"type":"points_total","value":10000}'::jsonb,22),
  ('first_redemption','Recompensado','Resgatou seu primeiro prêmio','gift','reward',25,'{"type":"redemptions_count","value":1}'::jsonb,30),
  ('redemption_5','Colecionador de Prêmios','5 prêmios resgatados','gift','reward',150,'{"type":"redemptions_count","value":5}'::jsonb,31),
  ('subscriber','Assinante KMKZ','Ativou uma assinatura','crown','subscription',75,'{"type":"active_subscription","value":1}'::jsonb,40)
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name, description=EXCLUDED.description, icon=EXCLUDED.icon,
  category=EXCLUDED.category, points_reward=EXCLUDED.points_reward,
  criteria=EXCLUDED.criteria, sort_order=EXCLUDED.sort_order;

CREATE OR REPLACE FUNCTION public.claim_daily_login()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _user UUID := auth.uid();
  _pts INT; _limit INT; _count INT;
  _last DATE; _cur INT; _long INT; _today DATE := (now() AT TIME ZONE 'utc')::date;
  _bonus INT := 0;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT points, COALESCE(daily_limit,1) INTO _pts, _limit
    FROM public.point_rules WHERE id='daily_login' AND active;
  IF _pts IS NULL THEN RAISE EXCEPTION 'rule_inactive'; END IF;
  SELECT count(*) INTO _count FROM public.point_events
    WHERE user_id=_user AND kind='daily_login'
      AND created_at >= date_trunc('day', now())
      AND created_at <  date_trunc('day', now()) + INTERVAL '1 day';
  IF _count >= _limit THEN RAISE EXCEPTION 'already_claimed_today'; END IF;

  SELECT last_login_date, current_streak, longest_streak
    INTO _last, _cur, _long
    FROM public.user_points WHERE user_id=_user FOR UPDATE;

  IF _last IS NULL OR _last < _today - INTERVAL '1 day' THEN
    _cur := 1;
  ELSIF _last = _today - INTERVAL '1 day' THEN
    _cur := COALESCE(_cur,0) + 1;
  ELSE
    _cur := COALESCE(_cur,1);
  END IF;
  _long := GREATEST(COALESCE(_long,0), _cur);

  IF _cur > 0 AND _cur % 7 = 0 THEN _bonus := 20; END IF;

  INSERT INTO public.point_events (user_id, kind, points, description, metadata)
    VALUES (_user,'daily_login', _pts + _bonus,
            CASE WHEN _bonus>0 THEN 'Login diário • ' || _cur || ' dias 🔥' ELSE 'Login diário' END,
            jsonb_build_object('streak',_cur,'bonus',_bonus));
  UPDATE public.user_points SET
    total_points = total_points + _pts + _bonus,
    current_streak = _cur,
    longest_streak = _long,
    last_login_date = _today
  WHERE user_id=_user;

  RETURN jsonb_build_object('points',_pts+_bonus,'streak',_cur,'bonus',_bonus,'longest',_long);
END; $$;

CREATE OR REPLACE FUNCTION public.check_and_award_achievements()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _user UUID := auth.uid();
  _ach RECORD; _type TEXT; _val INT; _current INT;
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
    ELSIF _type = 'streak' THEN
      SELECT COALESCE(GREATEST(current_streak,longest_streak),0) INTO _current FROM public.user_points WHERE user_id=_user;
    ELSIF _type = 'share_count' THEN
      SELECT count(*) INTO _current FROM public.point_events WHERE user_id=_user AND kind='share';
    ELSIF _type = 'login_count' THEN
      SELECT GREATEST(count(*),1) INTO _current FROM public.point_events WHERE user_id=_user AND kind='daily_login';
    ELSIF _type = 'redemptions_count' THEN
      SELECT count(*) INTO _current FROM public.reward_redemptions WHERE user_id=_user;
    ELSIF _type = 'active_subscription' THEN
      SELECT CASE WHEN EXISTS(SELECT 1 FROM public.subscriptions WHERE user_id=_user AND status='active') THEN 1 ELSE 0 END INTO _current;
    END IF;

    IF _current >= _val THEN
      INSERT INTO public.user_achievements (user_id, achievement_id)
        VALUES (_user, _ach.id) ON CONFLICT DO NOTHING;
      IF _ach.points_reward > 0 THEN
        INSERT INTO public.point_events (user_id, kind, points, description, metadata)
          VALUES (_user,'achievement', _ach.points_reward, 'Conquista: ' || _ach.name,
                  jsonb_build_object('achievement_id', _ach.id));
        UPDATE public.user_points SET total_points = total_points + _ach.points_reward WHERE user_id=_user;
      END IF;
      _newly := _newly || jsonb_build_object('id',_ach.id,'name',_ach.name,'icon',_ach.icon,'points',_ach.points_reward);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('unlocked', _newly);
END; $$;

DROP POLICY IF EXISTS "Profiles are public read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_authenticated" ON public.profiles;
CREATE POLICY "profiles_read_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
