
CREATE OR REPLACE FUNCTION public.place_bid_atomic(p_auction_id uuid, p_player_id uuid, p_owner_id uuid, p_bid_amount integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_bid INTEGER;
  v_is_active BOOLEAN;
  v_remaining_points INTEGER;
BEGIN
  -- Lock auction row to prevent concurrent modifications
  SELECT current_bid, is_active INTO v_current_bid, v_is_active
  FROM current_auction
  WHERE id = p_auction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Auction not found');
  END IF;

  IF NOT v_is_active THEN
    RETURN jsonb_build_object('error', 'Auction is not active');
  END IF;

  IF p_bid_amount <= v_current_bid THEN
    RETURN jsonb_build_object('error', 'Bid must be higher than current bid');
  END IF;

  -- Check owner has sufficient points
  SELECT remaining_points INTO v_remaining_points
  FROM owners
  WHERE id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Owner not found');
  END IF;

  IF p_bid_amount > v_remaining_points THEN
    RETURN jsonb_build_object('error', 'Insufficient points');
  END IF;

  -- Insert bid record
  INSERT INTO bids (player_id, owner_id, bid_amount)
  VALUES (p_player_id, p_owner_id, p_bid_amount);

  -- Update auction state atomically
  UPDATE current_auction
  SET 
    current_bid = p_bid_amount,
    current_bidder_id = p_owner_id,
    timer_started_at = NOW(),
    updated_at = NOW()
  WHERE id = p_auction_id;

  RETURN jsonb_build_object('success', true, 'new_bid', p_bid_amount);
END;
$function$;
