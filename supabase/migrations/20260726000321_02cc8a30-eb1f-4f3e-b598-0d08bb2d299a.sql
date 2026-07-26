-- ============ 1. SUBSCRIPTIONS: bloquear escrita direta pelo cliente ============
DROP POLICY IF EXISTS "Users create own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users update own subscriptions" ON public.subscriptions;

CREATE POLICY "Admins manage subscriptions"
  ON public.subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "No direct subscription inserts"
  ON public.subscriptions FOR INSERT TO anon, authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "No direct subscription deletes"
  ON public.subscriptions FOR DELETE TO anon, authenticated
  USING (public.has_role(auth.uid(), 'admin'));

REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon;
GRANT SELECT, UPDATE, DELETE, INSERT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

-- ============ 2. PROFILES: congelar campos sensíveis ============
CREATE OR REPLACE FUNCTION public.protect_profile_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role / postgres (servidor) podem ajustar; usuários autenticados não.
  IF current_setting('role', true) = 'authenticated' OR auth.uid() IS NOT NULL THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      NEW.id := OLD.id;
      NEW.referral_code := OLD.referral_code;
      IF OLD.cpf IS NOT NULL THEN
        NEW.cpf := OLD.cpf;
      END IF;
      NEW.created_at := OLD.created_at;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_immutable_fields();

REVOKE EXECUTE ON FUNCTION public.protect_profile_immutable_fields() FROM PUBLIC, anon, authenticated;

-- ============ 3. NOTIFICATIONS: usuário só marca como lida ============
CREATE OR REPLACE FUNCTION public.protect_notification_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.id := OLD.id;
    NEW.user_id := OLD.user_id;
    NEW.type := OLD.type;
    NEW.title := OLD.title;
    NEW.body := OLD.body;
    NEW.link := OLD.link;
    NEW.metadata := OLD.metadata;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_notification_fields ON public.notifications;
CREATE TRIGGER trg_protect_notification_fields
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.protect_notification_fields();

REVOKE EXECUTE ON FUNCTION public.protect_notification_fields() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============ 4. ÍNDICES DE DESEMPENHO ============
CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx ON public.referrals (referrer_id);
CREATE INDEX IF NOT EXISTS referrals_referred_id_idx ON public.referrals (referred_id);
CREATE INDEX IF NOT EXISTS point_events_user_created_idx ON public.point_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS point_events_expiry_idx ON public.point_events (expires_at) WHERE expired = false;
CREATE INDEX IF NOT EXISTS reward_redemptions_user_idx ON public.reward_redemptions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reward_redemptions_status_idx ON public.reward_redemptions (status);
CREATE INDEX IF NOT EXISTS user_achievements_user_idx ON public.user_achievements (user_id);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS subscriptions_status_ends_idx ON public.subscriptions (status, ends_at);
CREATE INDEX IF NOT EXISTS user_roles_user_idx ON public.user_roles (user_id);