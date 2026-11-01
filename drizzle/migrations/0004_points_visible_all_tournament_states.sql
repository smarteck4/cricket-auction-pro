DROP POLICY IF EXISTS "View points of started tournaments" ON public.tournament_points;
CREATE POLICY "View points of listed tournaments" ON public.tournament_points FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_points.tournament_id AND t.status IN ('upcoming','ongoing','completed'))
  OR public.is_admin_or_super(auth.uid())
);