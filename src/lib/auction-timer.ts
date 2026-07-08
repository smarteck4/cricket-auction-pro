// Pure, testable helpers for the live-auction countdown and bid outcome handling.
//
// These are deliberately free of React / Supabase so they can be unit-tested,
// including simulating clock skew between a bidder's device and the server.

export interface RemainingInput {
  /** ISO timestamp when the server (re)started the timer, or null if not running. */
  timerStartedAt: string | null;
  /** Timer length in seconds (matches current_auction.timer_duration). */
  timerDuration: number;
  /** Whether the auction is currently active. */
  isActive: boolean;
  /** The device clock reading (e.g. Date.now()), in ms. */
  nowMs: number;
  /** serverNow - clientNow offset in ms (see computeServerOffset). */
  serverOffsetMs: number;
}

/**
 * Seconds remaining on the auction timer, corrected for device clock skew.
 * Mirrors what the UI displays and gates the bid button on.
 */
export function calculateTimeRemaining({
  timerStartedAt,
  timerDuration,
  isActive,
  nowMs,
  serverOffsetMs,
}: RemainingInput): number {
  if (!isActive || !timerStartedAt) return 0;
  const startTime = new Date(timerStartedAt).getTime();
  const serverAlignedNow = nowMs + serverOffsetMs;
  const elapsed = Math.floor((serverAlignedNow - startTime) / 1000);
  return Math.max(0, timerDuration - elapsed);
}

/**
 * Estimate (serverNow - clientNow) in ms from a round-tripped server time read.
 * Assumes the server timestamp was taken at the midpoint of the round trip.
 */
export function computeServerOffset(
  clientSentAtMs: number,
  clientReceivedAtMs: number,
  serverIso: string,
): number {
  const serverMs = new Date(serverIso).getTime();
  const clientMidpoint = clientSentAtMs + (clientReceivedAtMs - clientSentAtMs) / 2;
  return serverMs - clientMidpoint;
}

/**
 * Authoritative server-side timer check, mirroring place_bid_atomic:
 *   v_elapsed := EXTRACT(EPOCH FROM (NOW() - timer_started_at));
 *   IF v_elapsed >= timer_duration THEN -> TIMER_EXPIRED
 * Used in tests to model whether the server would reject a bid.
 */
export function serverWouldRejectAsExpired({
  timerStartedAt,
  timerDuration,
  serverNowMs,
}: {
  timerStartedAt: string | null;
  timerDuration: number;
  serverNowMs: number;
}): boolean {
  if (!timerStartedAt) return false;
  const startTime = new Date(timerStartedAt).getTime();
  const elapsedSeconds = (serverNowMs - startTime) / 1000;
  return elapsedSeconds >= timerDuration;
}

export type BidRpcResult = {
  success?: boolean;
  error?: string;
  error_code?: string;
} | null;

export type BidOutcome =
  | { kind: 'success'; bidAmount: number }
  | { kind: 'timer_expired' }
  | { kind: 'error'; code?: string; message: string };

/**
 * Classify the result of place_bid_atomic into a UI outcome.
 * TIMER_EXPIRED is treated as an expected "too late" case rather than a hard error.
 */
export function classifyBidResult(
  result: BidRpcResult,
  rpcError: { message: string } | null,
  bidAmount: number,
): BidOutcome {
  if (rpcError || result?.error) {
    if (result?.error_code === 'TIMER_EXPIRED') {
      return { kind: 'timer_expired' };
    }
    return {
      kind: 'error',
      code: result?.error_code,
      message: result?.error || rpcError?.message || 'Unknown error',
    };
  }
  return { kind: 'success', bidAmount };
}

// ---------------------------------------------------------------------------
// Bid button gating
// ---------------------------------------------------------------------------

/**
 * Whether the bid window should be treated as closed for UI gating.
 *
 * IMPORTANT: we only trust the client countdown once it has been aligned to the
 * server clock (`clockSynced`). A device whose clock runs ahead of the server
 * would otherwise report `timeRemaining <= 0` and falsely lock the bid button on
 * "Timer Expired" while the auction is still open on the server.
 */
export function isBidWindowClosed(clockSynced: boolean, timeRemaining: number): boolean {
  return clockSynced && timeRemaining <= 0;
}

export interface BidButtonInput {
  /** A bid RPC is currently in flight. */
  bidding: boolean;
  /** Whether the countdown has been aligned to the server clock. */
  clockSynced: boolean;
  /** Server-aligned seconds left on the timer. */
  timeRemaining: number;
  /** Whether the owner can afford the next bid (points reserve check). */
  canAfford: boolean;
}

/**
 * Should the quick/custom bid button be disabled?
 * Mirrors the gating used in the Auction page so it can be unit-tested,
 * including under simulated clock skew.
 */
export function isBidButtonDisabled({
  bidding,
  clockSynced,
  timeRemaining,
  canAfford,
}: BidButtonInput): boolean {
  return bidding || isBidWindowClosed(clockSynced, timeRemaining) || !canAfford;
}

// ---------------------------------------------------------------------------
// Real-time auction propagation (what each owner screen derives from a broadcast)
// ---------------------------------------------------------------------------

/** Minimal shape of a current_auction row as broadcast over realtime. */
export interface AuctionSnapshot {
  auctionId: string;
  playerId: string | null;
  currentBid: number;
  currentBidderId: string | null;
  timerStartedAt: string | null;
  isActive: boolean;
}

/** Per-screen state each owner's client keeps between realtime events. */
export interface OwnerScreenState {
  auction: AuctionSnapshot | null;
  /** Last bid amount already surfaced (used to fire the "new bid" chime once). */
  lastSeenBid: number | null;
}

/** Side effects an owner screen should trigger when a broadcast arrives. */
export interface RealtimeEffects {
  /** A different player is now on the block -> render the new player instantly. */
  playerChanged: boolean;
  /** The leading bidder changed -> swap the leading-bidder logo/team. */
  bidderChanged: boolean;
  /** A fresh, higher bid arrived -> play sound / show toast. */
  newBid: boolean;
  /** The timer was (re)started -> reset the countdown. */
  timerReset: boolean;
}

export function initialOwnerScreenState(): OwnerScreenState {
  return { auction: null, lastSeenBid: null };
}

/**
 * Pure reducer modelling how a single owner screen reacts to a current_auction
 * broadcast. Because every owner client runs this same reducer against the same
 * broadcast, feeding N instances the same event verifies that the timer,
 * leading-bidder logo, and player appearance stay consistent on every screen.
 */
export function applyAuctionRealtimeEvent(
  prev: OwnerScreenState,
  next: AuctionSnapshot,
): { state: OwnerScreenState; effects: RealtimeEffects } {
  const prevAuction = prev.auction;
  const playerChanged = (prevAuction?.playerId ?? null) !== (next.playerId ?? null);
  const bidderChanged = (prevAuction?.currentBidderId ?? null) !== (next.currentBidderId ?? null);
  const timerReset = (prevAuction?.timerStartedAt ?? null) !== (next.timerStartedAt ?? null);
  const newBid = next.isActive && next.currentBid > 0 && next.currentBid !== prev.lastSeenBid;

  return {
    state: {
      auction: next,
      lastSeenBid: newBid ? next.currentBid : prev.lastSeenBid,
    },
    effects: { playerChanged, bidderChanged, newBid, timerReset },
  };
}
