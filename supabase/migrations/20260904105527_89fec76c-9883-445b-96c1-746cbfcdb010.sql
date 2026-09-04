-- 1. Activity timeline table
CREATE TABLE public.auction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES public.owners(id) ON DELETE SET NULL,
  amount integer,
  points_before integer,
  points_after integer,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.auction_events TO anon;
GRANT SELECT ON public.auction_events TO authenticated;
GRANT ALL ON public.auction_events TO service_role;

ALTER TABLE public.auction_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view auction activity"
  ON public.auction_events FOR SELECT
  USING (true);

CREATE INDEX auction_events_created_at_idx ON public.auction_events (created_at DESC);

ALTER TABLE public.auction_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_events;

-- 2. Triggers that feed the timeline
CREATE OR REPLACE FUNCTION public.log_bid_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team text;
  v_player text;
BEGIN
  SELECT team_name INTO v_team FROM owners WHERE id = NEW.owner_id;
  SELECT name INTO v_player FROM players WHERE id = NEW.player_id;
  INSERT INTO auction_events (event_type, player_id, owner_id, amount, message)
  VALUES ('bid', NEW.player_id, NEW.owner_id, NEW.bid_amount,
          COALESCE(v_team, 'A team') || ' bid ' || NEW.bid_amount || ' pts for ' || COALESCE(v_player, 'a player'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_bid_logged ON public.bids;
CREATE TRIGGER on_bid_logged AFTER INSERT ON public.bids
FOR EACH ROW EXECUTE FUNCTION public.log_bid_event();

CREATE OR REPLACE FUNCTION public.log_points_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta integer;
BEGIN
  IF NEW.remaining_points IS DISTINCT FROM OLD.remaining_points THEN
    v_delta := NEW.remaining_points - OLD.remaining_points;
    INSERT INTO auction_events (event_type, owner_id, amount, points_before, points_after, message)
    VALUES ('points', NEW.id, v_delta, OLD.remaining_points, NEW.remaining_points,
            NEW.team_name || (CASE WHEN v_delta > 0 THEN ' gained ' ELSE ' spent ' END) || abs(v_delta) || ' pts (purse ' || NEW.remaining_points || ')');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_owner_points_logged ON public.owners;
CREATE TRIGGER on_owner_points_logged AFTER UPDATE ON public.owners
FOR EACH ROW EXECUTE FUNCTION public.log_points_event();

CREATE OR REPLACE FUNCTION public.log_player_status_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tp RECORD;
  v_team text;
BEGIN
  IF NEW.auction_status IS DISTINCT FROM OLD.auction_status THEN
    IF NEW.auction_status = 'sold' THEN
      SELECT tp.bought_price, o.team_name, o.id AS owner_id INTO v_tp
      FROM team_players tp JOIN owners o ON o.id = tp.owner_id
      WHERE tp.player_id = NEW.id;
      INSERT INTO auction_events (event_type, player_id, owner_id, amount, message)
      VALUES ('sold', NEW.id, v_tp.owner_id, v_tp.bought_price,
              NEW.name || ' SOLD to ' || COALESCE(v_tp.team_name, 'a team') || ' for ' || COALESCE(v_tp.bought_price, 0) || ' pts');
    ELSIF NEW.auction_status = 'unsold' THEN
      INSERT INTO auction_events (event_type, player_id, message)
      VALUES ('unsold', NEW.id, NEW.name || ' went UNSOLD');
    ELSIF NEW.auction_status = 'active' THEN
      INSERT INTO auction_events (event_type, player_id, amount, message)
      VALUES ('started', NEW.id, NEW.base_price, NEW.name || ' is on the block (base ' || COALESCE(NEW.base_price, 0) || ' pts)');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_player_status_logged ON public.players;
CREATE TRIGGER on_player_status_logged AFTER UPDATE ON public.players
FOR EACH ROW EXECUTE FUNCTION public.log_player_status_event();

-- 3. Stronger conflict handling for simultaneous highest bids
DROP FUNCTION IF EXISTS public.place_bid_atomic(uuid, uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.place_bid_atomic(
  p_auction_id uuid,
  p_player_id uuid,
  p_owner_id uuid,
  p_bid_amount integer,
  p_expected_current_bid integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_auction RECORD;
  v_owner RECORD;
  v_leader_name text;
  v_player_status auction_status;
  v_max_bid INTEGER := 1000000000;
  v_elapsed NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error_code', 'UNAUTHENTICATED', 'error', 'You must be signed in to bid');
  END IF;

  IF p_auction_id IS NULL OR p_player_id IS NULL OR p_owner_id IS NULL THEN
    RETURN jsonb_build_object('error_code', 'INVALID_PARAMS', 'error', 'Missing required parameters');
  END IF;

  IF p_bid_amount IS NULL OR p_bid_amount <= 0 THEN
    RETURN jsonb_build_object('error_code', 'INVALID_BID_AMOUNT', 'error', 'Bid amount must be positive');
  END IF;

  IF p_bid_amount > v_max_bid THEN
    RETURN jsonb_build_object('error_code', 'BID_TOO_LARGE', 'error', 'Bid exceeds maximum allowed');
  END IF;

  -- Serialize concurrent bids for the same auction before touching any row
  PERFORM pg_advisory_xact_lock(hashtextextended(p_auction_id::text, 0));

  SELECT * INTO v_owner FROM owners WHERE id = p_owner_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error_code', 'OWNER_NOT_FOUND', 'error', 'Owner not found');
  END IF;

  IF v_owner.user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('error_code', 'NOT_OWNER', 'error', 'You can only bid as your own team');
  END IF;

  IF NOT public.has_role(v_uid, 'owner'::app_role) THEN
    RETURN jsonb_build_object('error_code', 'NOT_OWNER_ROLE', 'error', 'Only owners can place bids');
  END IF;

  SELECT * INTO v_auction FROM current_auction WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error_code', 'AUCTION_NOT_FOUND', 'error', 'Auction not found');
  END IF;

  IF NOT v_auction.is_active THEN
    RETURN jsonb_build_object('error_code', 'AUCTION_INACTIVE', 'error', 'Auction is not active');
  END IF;

  IF v_auction.player_id IS NULL OR v_auction.player_id <> p_player_id THEN
    RETURN jsonb_build_object('error_code', 'PLAYER_MISMATCH', 'error', 'Bid does not match the player currently on auction');
  END IF;

  IF v_auction.timer_started_at IS NOT NULL THEN
    v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_auction.timer_started_at));
    IF v_elapsed >= v_auction.timer_duration THEN
      RETURN jsonb_build_object('error_code', 'TIMER_EXPIRED', 'error', 'Auction timer has expired');
    END IF;
  END IF;

  SELECT auction_status INTO v_player_status FROM players WHERE id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error_code', 'PLAYER_NOT_FOUND', 'error', 'Player not found');
  END IF;

  IF v_player_status = 'sold' THEN
    RETURN jsonb_build_object('error_code', 'PLAYER_ALREADY_SOLD', 'error', 'Player has already been sold');
  END IF;

  SELECT team_name INTO v_leader_name FROM owners WHERE id = v_auction.current_bidder_id;

  -- Optimistic concurrency: the client tells us the bid it based its amount on
  IF p_expected_current_bid IS NOT NULL AND p_expected_current_bid <> v_auction.current_bid THEN
    RETURN jsonb_build_object(
      'error_code', 'BID_OUTBID',
      'error', 'Another team bid first — the highest bid is now ' || v_auction.current_bid || ' pts',
      'current_bid', v_auction.current_bid,
      'current_bidder_id', v_auction.current_bidder_id,
      'current_bidder_name', v_leader_name
    );
  END IF;

  IF v_auction.current_bidder_id = p_owner_id THEN
    RETURN jsonb_build_object(
      'error_code', 'ALREADY_HIGHEST',
      'error', 'You already hold the highest bid',
      'current_bid', v_auction.current_bid
    );
  END IF;

  IF p_bid_amount <= v_auction.current_bid THEN
    RETURN jsonb_build_object(
      'error_code', 'BID_OUTBID',
      'error', 'Another team bid first — the highest bid is now ' || v_auction.current_bid || ' pts',
      'current_bid', v_auction.current_bid,
      'current_bidder_id', v_auction.current_bidder_id,
      'current_bidder_name', v_leader_name
    );
  END IF;

  IF v_auction.current_bid > 0
     AND p_bid_amount > GREATEST(v_auction.current_bid * 3, v_auction.current_bid + 10000) THEN
    RETURN jsonb_build_object('error_code', 'BID_INCREMENT_TOO_LARGE', 'error', 'Bid increment is too large');
  END IF;

  IF p_bid_amount > v_owner.remaining_points THEN
    RETURN jsonb_build_object('error_code', 'INSUFFICIENT_POINTS', 'error', 'Insufficient points');
  END IF;

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
$$;

REVOKE ALL ON FUNCTION public.place_bid_atomic(uuid, uuid, uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_bid_atomic(uuid, uuid, uuid, integer, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.log_bid_event() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_points_event() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_player_status_event() FROM PUBLIC, anon;