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
