-- ============================================================
-- place_bid_atomic: strict validation + structured error codes
-- ============================================================
CREATE OR REPLACE FUNCTION public.place_bid_atomic(
  p_auction_id uuid,
  p_player_id uuid,
  p_owner_id uuid,
  p_bid_amount integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_auction RECORD;
  v_owner RECORD;
  v_player_status auction_status;
  v_min_increment INTEGER := 50;
  v_max_bid INTEGER := 1000000000; -- absolute sanity ceiling
  v_elapsed NUMERIC;
BEGIN
  ---------------------------------------------------------------
  -- 1. Authentication
  ---------------------------------------------------------------
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error_code', 'UNAUTHENTICATED', 'error', 'You must be signed in to bid');
  END IF;

  ---------------------------------------------------------------
  -- 2. Parameter presence + type sanity
  ---------------------------------------------------------------
  IF p_auction_id IS NULL OR p_player_id IS NULL OR p_owner_id IS NULL THEN
    RETURN jsonb_build_object('error_code', 'INVALID_PARAMS', 'error', 'Missing required parameters');
  END IF;

  IF p_bid_amount IS NULL OR p_bid_amount <= 0 THEN
    RETURN jsonb_build_object('error_code', 'INVALID_BID_AMOUNT', 'error', 'Bid amount must be positive');
  END IF;

  IF p_bid_amount > v_max_bid THEN
    RETURN jsonb_build_object('error_code', 'BID_TOO_LARGE', 'error', 'Bid exceeds maximum allowed');
  END IF;

  ---------------------------------------------------------------
  -- 3. Owner identity check — caller must own the bidding owner row
  ---------------------------------------------------------------
  SELECT * INTO v_owner
  FROM owners
  WHERE id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error_code', 'OWNER_NOT_FOUND', 'error', 'Owner not found');
  END IF;

  IF v_owner.user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('error_code', 'NOT_OWNER', 'error', 'You can only bid as your own team');
  END IF;

  IF NOT public.has_role(v_uid, 'owner'::app_role) THEN
    RETURN jsonb_build_object('error_code', 'NOT_OWNER_ROLE', 'error', 'Only owners can place bids');
  END IF;

  ---------------------------------------------------------------
  -- 4. Auction state validation (locked)
  ---------------------------------------------------------------
  SELECT * INTO v_auction
  FROM current_auction
  WHERE id = p_auction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error_code', 'AUCTION_NOT_FOUND', 'error', 'Auction not found');
  END IF;

  IF NOT v_auction.is_active THEN
    RETURN jsonb_build_object('error_code', 'AUCTION_INACTIVE', 'error', 'Auction is not active');
  END IF;

  IF v_auction.player_id IS NULL OR v_auction.player_id <> p_player_id THEN
    RETURN jsonb_build_object('error_code', 'PLAYER_MISMATCH', 'error', 'Bid does not match the player currently on auction');
  END IF;

  -- Server-side timer enforcement
  IF v_auction.timer_started_at IS NOT NULL THEN
    v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_auction.timer_started_at));
    IF v_elapsed >= v_auction.timer_duration THEN
      RETURN jsonb_build_object('error_code', 'TIMER_EXPIRED', 'error', 'Auction timer has expired');
    END IF;
  END IF;

  ---------------------------------------------------------------
  -- 5. Player must still be biddable
  ---------------------------------------------------------------
  SELECT auction_status INTO v_player_status
  FROM players
  WHERE id = p_player_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error_code', 'PLAYER_NOT_FOUND', 'error', 'Player not found');
  END IF;

  IF v_player_status = 'sold' THEN
    RETURN jsonb_build_object('error_code', 'PLAYER_ALREADY_SOLD', 'error', 'Player has already been sold');
  END IF;

  ---------------------------------------------------------------
  -- 6. Bid amount validation
  ---------------------------------------------------------------
  IF p_bid_amount <= v_auction.current_bid THEN
    RETURN jsonb_build_object('error_code', 'BID_TOO_LOW', 'error', 'Bid must be higher than current bid');
  END IF;

  -- Reject absurd jumps: bid must be at most current_bid + max(2x current_bid, owner remaining points)
  IF v_auction.current_bid > 0
     AND p_bid_amount > GREATEST(v_auction.current_bid * 3, v_auction.current_bid + 10000) THEN
    RETURN jsonb_build_object('error_code', 'BID_INCREMENT_TOO_LARGE', 'error', 'Bid increment is too large');
  END IF;

  IF p_bid_amount > v_owner.remaining_points THEN
    RETURN jsonb_build_object('error_code', 'INSUFFICIENT_POINTS', 'error', 'Insufficient points');
  END IF;

  ---------------------------------------------------------------
  -- 7. Persist bid + advance auction state
  ---------------------------------------------------------------
  INSERT INTO bids (player_id, owner_id, bid_amount)
  VALUES (p_player_id, p_owner_id, p_bid_amount);

  UPDATE current_auction
  SET current_bid = p_bid_amount,
      current_bidder_id = p_owner_id,
      timer_started_at = NOW(),
      updated_at = NOW()
  WHERE id = p_auction_id;

  RETURN jsonb_build_object('success', true, 'new_bid', p_bid_amount);
END;
$function$;


-- ============================================================
-- close_bid_atomic: strict validation + structured error codes
-- ============================================================
CREATE OR REPLACE FUNCTION public.close_bid_atomic(p_auction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_auction RECORD;
  v_player RECORD;
  v_owner RECORD;
  v_result jsonb;
BEGIN
  -- 1. Auth
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error_code', 'UNAUTHENTICATED', 'error', 'You must be signed in');
  END IF;

  IF NOT public.is_admin_or_super(v_uid) THEN
    RETURN jsonb_build_object('error_code', 'FORBIDDEN', 'error', 'Admin access required');
  END IF;

  -- 2. Param sanity
  IF p_auction_id IS NULL THEN
    RETURN jsonb_build_object('error_code', 'INVALID_PARAMS', 'error', 'Missing auction id');
  END IF;

  -- 3. Lock auction
  SELECT * INTO v_auction
  FROM current_auction
  WHERE id = p_auction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error_code', 'AUCTION_NOT_FOUND', 'error', 'Auction not found');
  END IF;

  -- Idempotent: already closed
  IF NOT v_auction.is_active THEN
    RETURN jsonb_build_object('success', true, 'already_closed', true);
  END IF;

  -- 4. Look up player (if any) with lock
  IF v_auction.player_id IS NOT NULL THEN
    SELECT * INTO v_player FROM players WHERE id = v_auction.player_id FOR UPDATE;
  END IF;

  IF v_auction.current_bidder_id IS NOT NULL AND v_player.id IS NOT NULL THEN
    -- Double-sell guard
    IF v_player.auction_status = 'sold' THEN
      UPDATE current_auction
      SET is_active = false, player_id = NULL, current_bidder_id = NULL,
          current_bid = 0, timer_started_at = NULL, updated_at = NOW()
      WHERE id = p_auction_id;
      RETURN jsonb_build_object('success', true, 'already_sold', true);
    END IF;

    SELECT * INTO v_owner FROM owners WHERE id = v_auction.current_bidder_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error_code', 'OWNER_NOT_FOUND', 'error', 'Winning owner not found');
    END IF;

    IF v_auction.current_bid <= 0 THEN
      RETURN jsonb_build_object('error_code', 'INVALID_AUCTION_STATE', 'error', 'Auction has invalid bid amount');
    END IF;

    IF v_owner.remaining_points < v_auction.current_bid THEN
      UPDATE players SET auction_status = 'unsold', updated_at = NOW() WHERE id = v_player.id;
      UPDATE current_auction
      SET is_active = false, player_id = NULL, current_bidder_id = NULL,
          current_bid = 0, timer_started_at = NULL, updated_at = NOW()
      WHERE id = p_auction_id;
      RETURN jsonb_build_object(
        'success', true, 'status', 'unsold', 'reason', 'insufficient_points',
        'player_name', v_player.name
      );
    END IF;

    INSERT INTO team_players (owner_id, player_id, bought_price)
    VALUES (v_owner.id, v_player.id, v_auction.current_bid)
    ON CONFLICT (player_id) DO NOTHING;

    UPDATE owners
    SET remaining_points = remaining_points - v_auction.current_bid, updated_at = NOW()
    WHERE id = v_owner.id;

    UPDATE players SET auction_status = 'sold', updated_at = NOW() WHERE id = v_player.id;

    v_result := jsonb_build_object(
      'success', true, 'status', 'sold',
      'player_name', v_player.name, 'team_name', v_owner.team_name,
      'sold_price', v_auction.current_bid
    );
  ELSIF v_player.id IS NOT NULL THEN
    UPDATE players SET auction_status = 'unsold', updated_at = NOW() WHERE id = v_player.id;
    v_result := jsonb_build_object('success', true, 'status', 'unsold', 'player_name', v_player.name);
  ELSE
    v_result := jsonb_build_object('success', true, 'status', 'no_player');
  END IF;

  UPDATE current_auction
  SET is_active = false, player_id = NULL, current_bidder_id = NULL,
      current_bid = 0, timer_started_at = NULL, updated_at = NOW()
  WHERE id = p_auction_id;

  RETURN v_result;
END;
$function$;