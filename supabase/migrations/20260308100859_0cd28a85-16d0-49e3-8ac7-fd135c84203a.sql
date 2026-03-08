
-- 1. Create atomic bid placement function to prevent race conditions
CREATE OR REPLACE FUNCTION public.place_bid_atomic(
  p_auction_id UUID,
  p_player_id UUID,
  p_owner_id UUID,
  p_bid_amount INTEGER
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.place_bid_atomic TO authenticated;

-- 2. Add unique constraint to prevent duplicate bid amounts per player
CREATE UNIQUE INDEX IF NOT EXISTS unique_player_bid_amount ON bids(player_id, bid_amount);

-- 3. Fix profiles table - restrict to authenticated users only
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- 4. Fix owners table - restrict to authenticated users only  
DROP POLICY IF EXISTS "Anyone can view owners" ON public.owners;
CREATE POLICY "Authenticated users can view owners"
  ON public.owners FOR SELECT
  TO authenticated
  USING (true);
