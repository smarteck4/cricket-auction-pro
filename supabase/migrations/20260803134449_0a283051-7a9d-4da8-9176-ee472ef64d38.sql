-- Admins get full access (same as super admin) except role management

-- players
DROP POLICY IF EXISTS "Scoped view players" ON public.players;
DROP POLICY IF EXISTS "Admins can insert own players" ON public.players;
DROP POLICY IF EXISTS "Admins can update own players" ON public.players;
DROP POLICY IF EXISTS "Admins can delete own players" ON public.players;
CREATE POLICY "Anyone can view players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Admins can insert players" ON public.players FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can update players" ON public.players FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can delete players" ON public.players FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

-- owners (teams)
DROP POLICY IF EXISTS "Admins can insert own owners" ON public.owners;
DROP POLICY IF EXISTS "Admins can update own owners" ON public.owners;
DROP POLICY IF EXISTS "Admins can delete own owners" ON public.owners;
CREATE POLICY "Admins can insert owners" ON public.owners FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can update owners" ON public.owners FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can delete owners" ON public.owners FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

-- current_auction
DROP POLICY IF EXISTS "Scoped view auction" ON public.current_auction;
DROP POLICY IF EXISTS "Admins can update own auction" ON public.current_auction;
DROP POLICY IF EXISTS "Admins can delete own auction" ON public.current_auction;
CREATE POLICY "Anyone can view auction" ON public.current_auction FOR SELECT USING (true);
CREATE POLICY "Admins can update auction" ON public.current_auction FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins can delete auction" ON public.current_auction FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

-- profiles: admins can view all
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));

-- user_roles: ONLY super admins may modify roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
