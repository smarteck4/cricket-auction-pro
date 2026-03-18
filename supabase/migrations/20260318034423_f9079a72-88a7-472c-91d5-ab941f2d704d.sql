
CREATE OR REPLACE FUNCTION public.close_bid_atomic(p_auction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auction RECORD;
  v_player RECORD;
  v_owner RECORD;
  v_result jsonb;
BEGIN
  -- Lock the auction row to prevent concurrent close attempts
  SELECT * INTO v_auction
  FROM current_auction
  WHERE id = p_auction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Auction not found');
  END IF;

  -- If already inactive, someone else closed it — return idempotent success
  IF NOT v_auction.is_active THEN
    RETURN jsonb_build_object('success', true, 'already_closed', true);
  END IF;

  -- Get the player
  IF v_auction.player_id IS NOT NULL THEN
    SELECT * INTO v_player FROM players WHERE id = v_auction.player_id FOR UPDATE;
  END IF;

  IF v_auction.current_bidder_id IS NOT NULL AND v_player.id IS NOT NULL THEN
    -- Check player hasn't already been sold (double-sell prevention)
    IF v_player.auction_status = 'sold' THEN
      -- Reset auction without selling again
      UPDATE current_auction
      SET is_active = false, player_id = NULL, current_bidder_id = NULL,
          current_bid = 0, timer_started_at = NULL, updated_at = NOW()
      WHERE id = p_auction_id;
      RETURN jsonb_build_object('success', true, 'already_sold', true);
    END IF;

    -- Lock the owner row for point deduction
    SELECT * INTO v_owner FROM owners WHERE id = v_auction.current_bidder_id FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Winning owner not found');
    END IF;

    IF v_owner.remaining_points < v_auction.current_bid THEN
      -- Owner can't afford it anymore — mark unsold
      UPDATE players SET auction_status = 'unsold', updated_at = NOW() WHERE id = v_player.id;
      UPDATE current_auction
      SET is_active = false, player_id = NULL, current_bidder_id = NULL,
          current_bid = 0, timer_started_at = NULL, updated_at = NOW()
      WHERE id = p_auction_id;
      RETURN jsonb_build_object('success', true, 'status', 'unsold', 'reason', 'insufficient_points',
        'player_name', v_player.name);
    END IF;

    -- Assign player to team
    INSERT INTO team_players (owner_id, player_id, bought_price)
    VALUES (v_owner.id, v_player.id, v_auction.current_bid)
    ON CONFLICT (player_id) DO NOTHING;

    -- Deduct points
    UPDATE owners
    SET remaining_points = remaining_points - v_auction.current_bid, updated_at = NOW()
    WHERE id = v_owner.id;

    -- Mark player as sold
    UPDATE players SET auction_status = 'sold', updated_at = NOW() WHERE id = v_player.id;

    v_result := jsonb_build_object(
      'success', true, 'status', 'sold',
      'player_name', v_player.name, 'team_name', v_owner.team_name,
      'sold_price', v_auction.current_bid
    );
  ELSIF v_player.id IS NOT NULL THEN
    -- No bidder — mark unsold
    UPDATE players SET auction_status = 'unsold', updated_at = NOW() WHERE id = v_player.id;
    v_result := jsonb_build_object('success', true, 'status', 'unsold', 'player_name', v_player.name);
  ELSE
    v_result := jsonb_build_object('success', true, 'status', 'no_player');
  END IF;

  -- Reset auction
  UPDATE current_auction
  SET is_active = false, player_id = NULL, current_bidder_id = NULL,
      current_bid = 0, timer_started_at = NULL, updated_at = NOW()
  WHERE id = p_auction_id;

  RETURN v_result;
END;
$$;
