
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.plan_period AS ENUM ('monthly', 'quarterly', 'semiannual', 'annual');
CREATE TYPE public.subscription_status AS ENUM ('active', 'canceled', 'expired');
CREATE TYPE public.referral_status AS ENUM ('pending', 'confirmed');
CREATE TYPE public.redemption_status AS ENUM ('pending', 'delivered', 'canceled');

-- =========================================================
-- UPDATED AT HELPER
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  referral_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- USER ROLES + has_role
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =========================================================
-- PLANS
-- =========================================================
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  period public.plan_period NOT NULL UNIQUE,
  price_cents INTEGER NOT NULL,
  duration_days INTEGER NOT NULL,
  referral_points INTEGER NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER plans_updated_at
BEFORE UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed 4 planos
INSERT INTO public.plans (name, period, price_cents, duration_days, referral_points, features, sort_order) VALUES
('Mensal',     'monthly',    3500,   30,  10, '["Acesso completo à plataforma","Bônus de indicação padrão"]'::jsonb, 1),
('Trimestral', 'quarterly',  9900,   90,  30, '["Acesso completo à plataforma","1.2x multiplicador de pontos"]'::jsonb, 2),
('Semestral',  'semiannual', 18000, 180,  60, '["1.5x multiplicador de pontos","Suporte prioritário 24/7"]'::jsonb, 3),
('Anual',      'annual',     30000, 365, 100, '["2x multiplicador de pontos","Acesso a prêmios VIP"]'::jsonb, 4);

-- =========================================================
-- SUBSCRIPTIONS
-- =========================================================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  status public.subscription_status NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX subscriptions_user_id_idx ON public.subscriptions(user_id);
CREATE TRIGGER subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- REFERRALS
-- =========================================================
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.referral_status NOT NULL DEFAULT 'pending',
  points_awarded INTEGER NOT NULL DEFAULT 0,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (referrer_id <> referred_id)
);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE INDEX referrals_referrer_idx ON public.referrals(referrer_id);
CREATE TRIGGER referrals_updated_at
BEFORE UPDATE ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- USER POINTS
-- =========================================================
CREATE TABLE public.user_points (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (total_points >= 0)
);
GRANT SELECT ON public.user_points TO authenticated;
GRANT ALL ON public.user_points TO service_role;
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER user_points_updated_at
BEFORE UPDATE ON public.user_points
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- REWARDS
-- =========================================================
CREATE TABLE public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rewards TO anon, authenticated;
GRANT ALL ON public.rewards TO service_role;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER rewards_updated_at
BEFORE UPDATE ON public.rewards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed prêmios exemplo
INSERT INTO public.rewards (name, description, points_cost, stock, sort_order) VALUES
('Gift Card R$ 50',       'Vale-presente digital de R$ 50 para uso em lojas parceiras.', 500, 100, 1),
('Fone Bluetooth',        'Fone Bluetooth wireless com cancelamento de ruído.',           1800, 20, 2),
('Gift Card R$ 100',      'Vale-presente digital de R$ 100.',                            1000, 100, 3),
('Mochila Executiva',     'Mochila premium para notebook até 15".',                      2500, 15, 4),
('Smartwatch',            'Relógio inteligente com monitor de saúde.',                   4000, 10, 5),
('Notebook Ultra',        'Notebook 14" para trabalho e estudo (prêmio VIP).',           15000, 3, 6);

-- =========================================================
-- REWARD REDEMPTIONS
-- =========================================================
CREATE TABLE public.reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.rewards(id),
  points_spent INTEGER NOT NULL,
  status public.redemption_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reward_redemptions TO authenticated;
GRANT ALL ON public.reward_redemptions TO service_role;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX reward_redemptions_user_idx ON public.reward_redemptions(user_id);
CREATE TRIGGER reward_redemptions_updated_at
BEFORE UPDATE ON public.reward_redemptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- RLS POLICIES
-- =========================================================

-- profiles
CREATE POLICY "Profiles visible to authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "Public can view profiles by referral code"
  ON public.profiles FOR SELECT
  TO anon
  USING (true);
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- user_roles
CREATE POLICY "Users see own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- plans
CREATE POLICY "Anyone can view active plans"
  ON public.plans FOR SELECT
  TO anon, authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage plans"
  ON public.plans FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- subscriptions
CREATE POLICY "Users view own subscriptions"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own subscriptions"
  ON public.subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own subscriptions"
  ON public.subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- referrals
CREATE POLICY "Users view own referrals"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id OR public.has_role(auth.uid(), 'admin'));

-- user_points
CREATE POLICY "Users view own points"
  ON public.user_points FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- rewards
CREATE POLICY "Anyone can view active rewards"
  ON public.rewards FOR SELECT
  TO anon, authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage rewards"
  ON public.rewards FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- reward_redemptions
CREATE POLICY "Users view own redemptions"
  ON public.reward_redemptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update redemptions"
  ON public.reward_redemptions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- REFERRAL CODE GENERATOR
-- =========================================================
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := 'REF-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN new_code;
END;
$$;

-- =========================================================
-- HANDLE NEW USER
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_code TEXT;
  referrer_uuid UUID;
BEGIN
  -- profile
  INSERT INTO public.profiles (id, display_name, avatar_url, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    public.generate_referral_code()
  );

  -- default role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  -- points balance
  INSERT INTO public.user_points (user_id, total_points) VALUES (NEW.id, 0);

  -- referral (if signup carried a ref code)
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

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- CONFIRM REFERRAL ON SUBSCRIPTION
-- =========================================================
CREATE OR REPLACE FUNCTION public.confirm_referral_on_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pts INTEGER;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT referral_points INTO pts FROM public.plans WHERE id = NEW.plan_id;
    pts := COALESCE(pts, 0);

    UPDATE public.referrals r
    SET status = 'confirmed',
        points_awarded = pts,
        confirmed_at = now()
    WHERE r.referred_id = NEW.user_id
      AND r.status = 'pending';

    -- Credit points to referrer if a referral was just confirmed
    UPDATE public.user_points up
    SET total_points = up.total_points + pts
    FROM public.referrals r
    WHERE r.referred_id = NEW.user_id
      AND r.confirmed_at IS NOT NULL
      AND r.confirmed_at >= now() - INTERVAL '5 seconds'
      AND up.user_id = r.referrer_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_subscription_created_confirm_referral
AFTER INSERT ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.confirm_referral_on_subscription();

-- =========================================================
-- REDEEM REWARD (atomic)
-- =========================================================
CREATE OR REPLACE FUNCTION public.redeem_reward(_reward_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user UUID := auth.uid();
  _cost INTEGER;
  _stock INTEGER;
  _active BOOLEAN;
  _balance INTEGER;
  _redemption_id UUID;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT points_cost, stock, active INTO _cost, _stock, _active
  FROM public.rewards WHERE id = _reward_id FOR UPDATE;

  IF _cost IS NULL THEN RAISE EXCEPTION 'reward_not_found'; END IF;
  IF NOT _active THEN RAISE EXCEPTION 'reward_inactive'; END IF;
  IF _stock <= 0 THEN RAISE EXCEPTION 'reward_out_of_stock'; END IF;

  SELECT total_points INTO _balance FROM public.user_points WHERE user_id = _user FOR UPDATE;
  IF _balance IS NULL OR _balance < _cost THEN
    RAISE EXCEPTION 'insufficient_points';
  END IF;

  UPDATE public.user_points SET total_points = total_points - _cost WHERE user_id = _user;
  UPDATE public.rewards SET stock = stock - 1 WHERE id = _reward_id;

  INSERT INTO public.reward_redemptions (user_id, reward_id, points_spent, status)
  VALUES (_user, _reward_id, _cost, 'pending')
  RETURNING id INTO _redemption_id;

  RETURN _redemption_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_reward(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_reward(UUID) TO authenticated;

-- =========================================================
-- ADMIN STATS (used by admin dashboard)
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'active_subscriptions', (SELECT count(*) FROM public.subscriptions WHERE status = 'active'),
    'total_revenue_cents', (SELECT COALESCE(sum(p.price_cents), 0) FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id WHERE s.status = 'active'),
    'confirmed_referrals', (SELECT count(*) FROM public.referrals WHERE status = 'confirmed'),
    'pending_redemptions', (SELECT count(*) FROM public.reward_redemptions WHERE status = 'pending')
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;
