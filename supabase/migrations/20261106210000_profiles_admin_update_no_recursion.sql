-- profiles: UPDATE policy must not SELECT from profiles (RLS recursion).
-- Root cause: profiles_admin_update (20260517225505_profiles) used
--   (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
-- After profiles_scoped_select (20260526200001), every row check re-enters
-- profiles RLS → infinite recursion when promoting/demoting roles from /admin.
-- Fix: use public.is_admin() (STABLE SECURITY DEFINER, SET search_path = public)
-- which reads profiles without triggering row policies.

DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;

CREATE POLICY profiles_admin_update
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON POLICY profiles_admin_update ON public.profiles IS
  'auth/scope: só admin atualiza perfis. Usa is_admin() para evitar recursão RLS com profiles_scoped_select.';
