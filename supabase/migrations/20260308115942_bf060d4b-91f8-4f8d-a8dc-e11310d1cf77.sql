
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
  -- Get player info
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

  -- If sold, refund the owner and remove from team
  IF v_player.auction_status = 'sold' THEN
    SELECT * INTO v_team_player FROM team_players WHERE player_id = p_player_id;
    IF FOUND THEN
      -- Refund full bought price
      UPDATE owners
      SET remaining_points = remaining_points + v_team_player.bought_price,
          updated_at = now()
      WHERE id = v_team_player.owner_id;

      -- Remove from team
      DELETE FROM team_players WHERE player_id = p_player_id;
    END IF;
  END IF;

  -- Auto-assign category based on updated stats
  v_total_runs := COALESCE(v_player.total_runs, 0);
  v_total_matches := COALESCE(v_player.total_matches, 0);
  v_wickets := COALESCE(v_player.wickets, 0);
  v_strike_rate := COALESCE(v_player.strike_rate, 0);

  -- Category logic: performance-based thresholds
  IF v_total_runs >= 500 OR v_wickets >= 30 OR (v_strike_rate >= 150 AND v_total_matches >= 10) THEN
    v_new_category := 'platinum';
  ELSIF v_total_runs >= 250 OR v_wickets >= 15 OR (v_strike_rate >= 130 AND v_total_matches >= 5) THEN
    v_new_category := 'gold';
  ELSIF v_total_runs >= 100 OR v_wickets >= 8 THEN
    v_new_category := 'silver';
  ELSE
    v_new_category := 'emerging';
  END IF;

  -- Get base price from category settings
  SELECT base_price INTO v_new_base_price
  FROM category_settings
  WHERE category = v_new_category;

  IF v_new_base_price IS NULL THEN
    v_new_base_price := 100;
  END IF;

  -- Update player: reset status, update category
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
