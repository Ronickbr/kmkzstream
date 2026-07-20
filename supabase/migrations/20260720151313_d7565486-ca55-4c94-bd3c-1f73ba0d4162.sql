
-- 1) profiles: explicit INSERT policy scoped to auth.uid()
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- 2) notifications: deny direct inserts from anon/authenticated (only backend/triggers via SECURITY DEFINER may insert)
CREATE POLICY "Deny direct notification inserts" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- 3) point_rules: restrict SELECT to admins only
DROP POLICY IF EXISTS rules_read_auth ON public.point_rules;
CREATE POLICY rules_read_admin ON public.point_rules
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4) Split plans/rewards anon policies so the anon path never invokes has_role,
--    allowing us to revoke EXECUTE on has_role from anon.
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.plans;
CREATE POLICY "Public can view active plans" ON public.plans
  FOR SELECT TO anon, authenticated
  USING (active = true);
CREATE POLICY "Admins can view all plans" ON public.plans
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can view active rewards" ON public.rewards;
CREATE POLICY "Public can view active rewards" ON public.rewards
  FOR SELECT TO anon, authenticated
  USING (active = true);
CREATE POLICY "Admins can view all rewards" ON public.rewards
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5) Revoke EXECUTE on has_role from anon and PUBLIC. Keep authenticated
--    (needed by RLS policies scoped TO authenticated).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
