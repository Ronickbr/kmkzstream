
-- 1. Table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id) WHERE read_at IS NULL;

-- 2. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- 3. RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 5. Helper: mark all read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user UUID := auth.uid();
  _count INTEGER;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.notifications SET read_at = now()
    WHERE user_id = _user AND read_at IS NULL;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END; $$;

REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

-- 6. Trigger: referral confirmed
CREATE OR REPLACE FUNCTION public.notify_referral_confirmed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (
      NEW.referrer_id,
      'referral',
      'Indicação confirmada! 🎉',
      'Você ganhou ' || COALESCE(NEW.points_awarded, 0) || ' pontos por uma nova indicação.',
      '/indicacoes',
      jsonb_build_object('referral_id', NEW.id, 'points', NEW.points_awarded)
    );
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_referral_confirmed
  AFTER UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.notify_referral_confirmed();

-- 7. Trigger: achievement unlocked
CREATE OR REPLACE FUNCTION public.notify_achievement_unlocked()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _name TEXT; _pts INTEGER; _icon TEXT;
BEGIN
  SELECT name, points_reward, icon INTO _name, _pts, _icon
  FROM public.achievements WHERE id = NEW.achievement_id;
  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (
    NEW.user_id,
    'achievement',
    '🏆 Nova conquista: ' || COALESCE(_name, 'desbloqueada'),
    CASE WHEN COALESCE(_pts,0) > 0
      THEN 'Você ganhou ' || _pts || ' pontos!'
      ELSE 'Continue assim para desbloquear mais recompensas.'
    END,
    '/conquistas',
    jsonb_build_object('achievement_id', NEW.achievement_id, 'icon', _icon, 'points', _pts)
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_achievement_unlocked
  AFTER INSERT ON public.user_achievements
  FOR EACH ROW EXECUTE FUNCTION public.notify_achievement_unlocked();

-- 8. Trigger: reward redemption status change
CREATE OR REPLACE FUNCTION public.notify_redemption_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _reward_name TEXT;
BEGIN
  SELECT name INTO _reward_name FROM public.rewards WHERE id = NEW.reward_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (
      NEW.user_id, 'reward',
      'Resgate solicitado 🎁',
      COALESCE(_reward_name,'Prêmio') || ' — seu resgate foi registrado.',
      '/premios',
      jsonb_build_object('redemption_id', NEW.id, 'status', NEW.status)
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (
      NEW.user_id, 'reward',
      CASE NEW.status::text
        WHEN 'fulfilled' THEN 'Prêmio entregue ✅'
        WHEN 'cancelled' THEN 'Resgate cancelado'
        ELSE 'Atualização de resgate'
      END,
      COALESCE(_reward_name,'Prêmio') || ' — status: ' || NEW.status::text,
      '/premios',
      jsonb_build_object('redemption_id', NEW.id, 'status', NEW.status)
    );
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_redemption_insert
  AFTER INSERT ON public.reward_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_redemption_status();
CREATE TRIGGER trg_notify_redemption_update
  AFTER UPDATE ON public.reward_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_redemption_status();

-- 9. Trigger: subscription activated
CREATE OR REPLACE FUNCTION public.notify_subscription_active()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _plan TEXT;
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    SELECT name INTO _plan FROM public.plans WHERE id = NEW.plan_id;
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (
      NEW.user_id, 'success',
      'Assinatura ativa! 🚀',
      'Seu plano ' || COALESCE(_plan,'') || ' está ativo. Aproveite!',
      '/dashboard',
      jsonb_build_object('subscription_id', NEW.id, 'plan_id', NEW.plan_id)
    );
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_subscription_insert
  AFTER INSERT ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_subscription_active();
CREATE TRIGGER trg_notify_subscription_update
  AFTER UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_subscription_active();

-- 10. Welcome notification on signup
CREATE OR REPLACE FUNCTION public.notify_welcome()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.id, 'info',
    'Bem-vindo à KMKZ IPTV! 👋',
    'Explore seu painel, compartilhe seu link de indicação e comece a acumular pontos.',
    '/dashboard'
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_welcome
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_welcome();
