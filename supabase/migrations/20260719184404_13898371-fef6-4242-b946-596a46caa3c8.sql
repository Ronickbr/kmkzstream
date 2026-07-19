
INSERT INTO public.point_rules (id, name, points, daily_limit, active)
VALUES ('signup_bonus', 'Bônus de boas-vindas', 100, NULL, true)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_code TEXT;
  referrer_uuid UUID;
  welcome_pts INTEGER;
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    public.generate_referral_code()
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  SELECT points INTO welcome_pts FROM public.point_rules WHERE id = 'signup_bonus' AND active;
  welcome_pts := COALESCE(welcome_pts, 0);
  INSERT INTO public.user_points (user_id, total_points) VALUES (NEW.id, welcome_pts);
  IF welcome_pts > 0 THEN
    INSERT INTO public.point_events (user_id, kind, points, description)
    VALUES (NEW.id, 'signup_bonus', welcome_pts, 'Bônus de boas-vindas');
  END IF;

  ref_code := NEW.raw_user_meta_data->>'referral_code';
  IF ref_code IS NOT NULL AND ref_code <> '' THEN
    SELECT id INTO referrer_uuid FROM public.profiles WHERE referral_code = ref_code;
    IF referrer_uuid IS NOT NULL AND referrer_uuid <> NEW.id THEN
      INSERT INTO public.referrals (referrer_id, referred_id, status)
      VALUES (referrer_uuid, NEW.id, 'pending')
      ON CONFLICT (referred_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS screen_limit INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quality TEXT NOT NULL DEFAULT 'HD',
  ADD COLUMN IF NOT EXISTS is_popular BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.leaderboard(_period TEXT DEFAULT 'month')
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _since TIMESTAMPTZ;
  _rows jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _period = 'week' THEN
    _since := date_trunc('week', now());
  ELSIF _period = 'all' THEN
    _since := 'epoch'::timestamptz;
  ELSE
    _since := date_trunc('month', now());
  END IF;

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.points DESC) INTO _rows
  FROM (
    SELECT
      pe.user_id,
      p.display_name,
      SUM(pe.points)::int AS points
    FROM public.point_events pe
    JOIN public.profiles p ON p.id = pe.user_id
    WHERE pe.created_at >= _since AND pe.points > 0
    GROUP BY pe.user_id, p.display_name
    ORDER BY points DESC
    LIMIT 20
  ) t;

  RETURN COALESCE(_rows, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.leaderboard(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leaderboard(TEXT) TO authenticated;

DROP POLICY IF EXISTS "Profiles are public read" ON public.profiles;
CREATE POLICY "Profiles readable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

UPDATE public.plans SET screen_limit = 1, quality = 'SD' WHERE lower(name) LIKE '%básico%' OR lower(name) LIKE '%basico%';
UPDATE public.plans SET screen_limit = 2, quality = 'HD' WHERE lower(name) LIKE '%padrão%' OR lower(name) LIKE '%padrao%';
UPDATE public.plans SET screen_limit = 4, quality = '4K', is_popular = true WHERE lower(name) LIKE '%premium%';
UPDATE public.plans SET screen_limit = 4, quality = '4K' WHERE lower(name) LIKE '%anual%';
