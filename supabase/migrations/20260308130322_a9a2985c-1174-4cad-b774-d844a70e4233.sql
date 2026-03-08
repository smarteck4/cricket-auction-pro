
CREATE OR REPLACE FUNCTION public.re_auction_player(p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  -- Authorization check
  IF NOT public.has_role(auth.uid(), 'admin') THEN
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
$$;

REVOKE EXECUTE ON FUNCTION public.re_auction_player(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.re_auction_player(uuid) TO authenticated;
