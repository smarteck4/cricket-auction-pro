
-- Create a helper function that checks if user is admin OR super_admin
CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'super_admin')
  )
$$;

-- Update players policies
DROP POLICY IF EXISTS "Admins can delete own players" ON public.players;
DROP POLICY IF EXISTS "Admins can insert own players" ON public.players;
DROP POLICY IF EXISTS "Admins can update own players" ON public.players;
DROP POLICY IF EXISTS "Scoped view players" ON public.players;

CREATE POLICY "Admins can delete own players" ON public.players
  FOR DELETE TO authenticated
  USING (is_admin_or_super(auth.uid()) AND (created_by = auth.uid() OR has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Admins can insert own players" ON public.players
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_super(auth.uid()) AND (created_by = auth.uid() OR has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Admins can update own players" ON public.players
  FOR UPDATE TO authenticated
  USING (is_admin_or_super(auth.uid()) AND (created_by = auth.uid() OR has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Scoped view players" ON public.players
  FOR SELECT TO authenticated
  USING (
    CASE
      WHEN has_role(auth.uid(), 'super_admin') THEN true
      WHEN has_role(auth.uid(), 'admin') THEN created_by = auth.uid()
      ELSE true
    END
  );

-- Update owners policies
DROP POLICY IF EXISTS "Admins can delete own owners" ON public.owners;
DROP POLICY IF EXISTS "Admins can insert own owners" ON public.owners;
DROP POLICY IF EXISTS "Admins can update own owners" ON public.owners;
DROP POLICY IF EXISTS "Owners can update own data" ON public.owners;
DROP POLICY IF EXISTS "Scoped view owners" ON public.owners;

CREATE POLICY "Admins can delete own owners" ON public.owners
  FOR DELETE TO authenticated
  USING (is_admin_or_super(auth.uid()) AND (created_by = auth.uid() OR has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Admins can insert own owners" ON public.owners
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_super(auth.uid()) AND (created_by = auth.uid() OR has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Admins can update own owners" ON public.owners
  FOR UPDATE TO authenticated
  USING (is_admin_or_super(auth.uid()) AND (created_by = auth.uid() OR has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Owners can update own data" ON public.owners
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Scoped view owners" ON public.owners
  FOR SELECT TO authenticated
  USING (
    CASE
      WHEN has_role(auth.uid(), 'super_admin') THEN true
      WHEN has_role(auth.uid(), 'admin') THEN created_by = auth.uid()
      ELSE true
    END
  );

-- Update current_auction policies
DROP POLICY IF EXISTS "Admins can delete own auction" ON public.current_auction;
DROP POLICY IF EXISTS "Admins can insert own auction" ON public.current_auction;
DROP POLICY IF EXISTS "Admins can update own auction" ON public.current_auction;
DROP POLICY IF EXISTS "Scoped view auction" ON public.current_auction;

CREATE POLICY "Admins can delete own auction" ON public.current_auction
  FOR DELETE TO authenticated
  USING (is_admin_or_super(auth.uid()) AND (created_by = auth.uid() OR has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Admins can insert own auction" ON public.current_auction
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can update own auction" ON public.current_auction
  FOR UPDATE TO authenticated
  USING (is_admin_or_super(auth.uid()) AND (created_by = auth.uid() OR has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Scoped view auction" ON public.current_auction
  FOR SELECT TO authenticated
  USING (
    CASE
      WHEN has_role(auth.uid(), 'super_admin') THEN true
      WHEN has_role(auth.uid(), 'admin') THEN created_by = auth.uid()
      ELSE true
    END
  );

-- Update team_players policies
DROP POLICY IF EXISTS "Admins can manage team players" ON public.team_players;
CREATE POLICY "Admins can manage team players" ON public.team_players
  FOR ALL USING (is_admin_or_super(auth.uid()));

-- Update other admin-only tables
DROP POLICY IF EXISTS "Admins can manage venues" ON public.venues;
CREATE POLICY "Admins can manage venues" ON public.venues
  FOR ALL USING (is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage tournaments" ON public.tournaments;
CREATE POLICY "Admins can manage tournaments" ON public.tournaments
  FOR ALL USING (is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage matches" ON public.matches;
CREATE POLICY "Admins can manage matches" ON public.matches
  FOR ALL USING (is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage innings" ON public.match_innings;
CREATE POLICY "Admins can manage innings" ON public.match_innings
  FOR ALL USING (is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage balls" ON public.match_balls;
CREATE POLICY "Admins can manage balls" ON public.match_balls
  FOR ALL USING (is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage player stats" ON public.player_match_stats;
CREATE POLICY "Admins can manage player stats" ON public.player_match_stats
  FOR ALL USING (is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage category settings" ON public.category_settings;
CREATE POLICY "Admins can manage category settings" ON public.category_settings
  FOR ALL USING (is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage points" ON public.tournament_points;
CREATE POLICY "Admins can manage points" ON public.tournament_points
  FOR ALL USING (is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (is_admin_or_super(auth.uid()));

-- Update re_auction_player to allow super_admin
CREATE OR REPLACE FUNCTION public.re_auction_player(p_player_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_player RECORD;
  v_team_player RECORD;
  v_new_category player_category;
  v_new_base_price INT;
  v_total_runs INT;
  v_total_matches INT;
  v_wickets INT;
  v_strike_rate NUMERIC;
BEGIN
  IF NOT public.is_admin_or_super(auth.uid()) THEN
    RETURN jsonb_build_object('error', 'Unauthorized: Admin access required');
  END IF;

  SELECT * INTO v_player FROM players WHERE id = p_player_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Player not found');
  END IF;

  IF v_player.auction_status = 'pending' THEN
    RETURN jsonb_build_object('error', 'Player is already pending auction');
  END IF;

  IF v_player.auction_status = 'active' THEN
    RETURN jsonb_build_object('error', 'Player is currently in an active auction');
  END IF;

  IF v_player.auction_status = 'sold' THEN
    SELECT * INTO v_team_player FROM team_players WHERE player_id = p_player_id;
    IF FOUND THEN
      UPDATE owners
      SET remaining_points = remaining_points + v_team_player.bought_price,
          updated_at = now()
      WHERE id = v_team_player.owner_id;
      DELETE FROM team_players WHERE player_id = p_player_id;
    END IF;
  END IF;

  v_total_runs := COALESCE(v_player.total_runs, 0);
  v_total_matches := COALESCE(v_player.total_matches, 0);
  v_wickets := COALESCE(v_player.wickets, 0);
  v_strike_rate := COALESCE(v_player.strike_rate, 0);

  IF v_total_runs >= 500 OR v_wickets >= 30 OR (v_strike_rate >= 150 AND v_total_matches >= 10) THEN
    v_new_category := 'platinum';
  ELSIF v_total_runs >= 250 OR v_wickets >= 15 OR (v_strike_rate >= 130 AND v_total_matches >= 5) THEN
    v_new_category := 'gold';
  ELSIF v_total_runs >= 100 OR v_wickets >= 8 THEN
    v_new_category := 'silver';
  ELSE
    v_new_category := 'emerging';
  END IF;

  SELECT base_price INTO v_new_base_price
  FROM category_settings
  WHERE category = v_new_category;

  IF v_new_base_price IS NULL THEN
    v_new_base_price := 100;
  END IF;

  UPDATE players
  SET auction_status = 'pending',
      category = v_new_category,
      base_price = v_new_base_price,
      updated_at = now()
  WHERE id = p_player_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_category', v_new_category,
    'new_base_price', v_new_base_price,
    'previous_status', v_player.auction_status
  );
END;
$function$;
