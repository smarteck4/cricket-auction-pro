DROP POLICY IF EXISTS "Anyone can view points table" ON public.tournament_points;
CREATE POLICY "View points of started tournaments" ON public.tournament_points FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_points.tournament_id AND t.status IN ('ongoing','completed'))
  OR public.is_admin_or_super(auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can view team players" ON public.team_players;
CREATE POLICY "View rosters of sold players" ON public.team_players FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.players p WHERE p.id = team_players.player_id AND p.auction_status = 'sold')
  OR owner_id = public.get_owner_id(auth.uid())
  OR public.is_admin_or_super(auth.uid())
);