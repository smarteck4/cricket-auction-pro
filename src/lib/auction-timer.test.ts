import { describe, it, expect } from 'vitest';
import {
  calculateTimeRemaining,
  computeServerOffset,
  serverWouldRejectAsExpired,
  classifyBidResult,
} from './auction-timer';

// A fixed reference point so tests are deterministic.
const SERVER_START = '2026-07-07T10:00:00.000Z';
const SERVER_START_MS = new Date(SERVER_START).getTime();
const DURATION = 30; // seconds, matches current_auction.timer_duration

describe('computeServerOffset', () => {
  it('estimates a positive offset when the device clock is behind the server', () => {
    // Device thinks it's 10:00:00; server responds with 10:00:05.
    const clientSent = SERVER_START_MS; // t0
    const clientReceived = SERVER_START_MS + 100; // 100ms round trip
    const serverIso = '2026-07-07T10:00:05.000Z';
    const offset = computeServerOffset(clientSent, clientReceived, serverIso);
    // ~+5000ms (minus half the 100ms round trip)
    expect(offset).toBeGreaterThan(4900);
    expect(offset).toBeLessThan(5000);
  });

  it('estimates a negative offset when the device clock is ahead of the server', () => {
    const clientSent = SERVER_START_MS + 5000; // device is 5s ahead
    const clientReceived = SERVER_START_MS + 5100;
    const serverIso = SERVER_START;
    const offset = computeServerOffset(clientSent, clientReceived, serverIso);
    expect(offset).toBeLessThan(-4900);
    expect(offset).toBeGreaterThan(-5100);
  });
});

describe('serverWouldRejectAsExpired (models place_bid_atomic)', () => {
  it('accepts a bid before the timer elapses', () => {
    const serverNowMs = SERVER_START_MS + 29_000; // 29s in
    expect(serverWouldRejectAsExpired({ timerStartedAt: SERVER_START, timerDuration: DURATION, serverNowMs })).toBe(false);
  });

  it('rejects a bid exactly at the boundary (elapsed >= duration)', () => {
    const serverNowMs = SERVER_START_MS + 30_000; // exactly 30s
    expect(serverWouldRejectAsExpired({ timerStartedAt: SERVER_START, timerDuration: DURATION, serverNowMs })).toBe(true);
  });

  it('rejects a bid after the timer elapses', () => {
    const serverNowMs = SERVER_START_MS + 31_000;
    expect(serverWouldRejectAsExpired({ timerStartedAt: SERVER_START, timerDuration: DURATION, serverNowMs })).toBe(true);
  });
});

describe('clock skew regression: countdown vs. server timer enforcement', () => {
  // The device clock is 8 seconds BEHIND the server. Without correction the UI
  // believes there are ~8 more seconds than the server actually allows.
  const SKEW_MS = -8000; // clientNow = serverNow + SKEW_MS  => device is behind
  const trueServerOffset = -SKEW_MS; // serverNow - clientNow = +8000

  // Pick a moment where the server has already expired the timer (elapsed = 30s)
  // but the device's raw clock only shows 22s elapsed.
  const serverNowMs = SERVER_START_MS + 30_000;
  const deviceNowMs = serverNowMs + SKEW_MS; // device reads 8s earlier

  it('WITHOUT skew correction, UI still shows time left while the server would reject (the bug)', () => {
    const uiRemaining = calculateTimeRemaining({
      timerStartedAt: SERVER_START,
      timerDuration: DURATION,
      isActive: true,
      nowMs: deviceNowMs,
      serverOffsetMs: 0, // no correction
    });
    const serverRejects = serverWouldRejectAsExpired({
      timerStartedAt: SERVER_START,
      timerDuration: DURATION,
      serverNowMs,
    });

    expect(uiRemaining).toBeGreaterThan(0); // UI thinks the owner can still bid...
    expect(serverRejects).toBe(true); // ...but the server rejects with TIMER_EXPIRED
  });

  it('WITH skew correction, the countdown reaches 0 in sync with the server', () => {
    const uiRemaining = calculateTimeRemaining({
      timerStartedAt: SERVER_START,
      timerDuration: DURATION,
      isActive: true,
      nowMs: deviceNowMs,
      serverOffsetMs: trueServerOffset, // corrected
    });
    const serverRejects = serverWouldRejectAsExpired({
      timerStartedAt: SERVER_START,
      timerDuration: DURATION,
      serverNowMs,
    });

    expect(uiRemaining).toBe(0); // bid button is disabled — no late bid is attempted
    expect(serverRejects).toBe(true);
    // Corrected UI state agrees with the server: expired means expired.
    expect(uiRemaining <= 0).toBe(serverRejects);
  });

  it('device clock AHEAD of server: correction prevents the UI from expiring too early', () => {
    const aheadSkew = 8000; // device is 8s ahead
    const serverNowEarly = SERVER_START_MS + 22_000; // server: 8s left
    const deviceNow = serverNowEarly + aheadSkew; // device raw: shows 30s elapsed
    const offset = -aheadSkew; // serverNow - clientNow

    const rawRemaining = calculateTimeRemaining({
      timerStartedAt: SERVER_START,
      timerDuration: DURATION,
      isActive: true,
      nowMs: deviceNow,
      serverOffsetMs: 0,
    });
    const correctedRemaining = calculateTimeRemaining({
      timerStartedAt: SERVER_START,
      timerDuration: DURATION,
      isActive: true,
      nowMs: deviceNow,
      serverOffsetMs: offset,
    });

    expect(rawRemaining).toBe(0); // would wrongly block a still-valid bid
    expect(correctedRemaining).toBe(8); // correctly allows the owner to keep bidding
  });
});

describe('classifyBidResult handles late-bid TIMER_EXPIRED', () => {
  it('maps TIMER_EXPIRED to a non-error "timer_expired" outcome', () => {
    const outcome = classifyBidResult(
      { error: 'Auction timer has expired', error_code: 'TIMER_EXPIRED' },
      null,
      500,
    );
    expect(outcome).toEqual({ kind: 'timer_expired' });
  });

  it('keeps other rejections as errors with their code and message', () => {
    const outcome = classifyBidResult(
      { error: 'Bid must be higher than current bid', error_code: 'BID_TOO_LOW' },
      null,
      500,
    );
    expect(outcome).toEqual({ kind: 'error', code: 'BID_TOO_LOW', message: 'Bid must be higher than current bid' });
  });

  it('treats a transport-level RPC error as a generic error', () => {
    const outcome = classifyBidResult(null, { message: 'network down' }, 500);
    expect(outcome).toEqual({ kind: 'error', code: undefined, message: 'network down' });
  });

  it('returns success with the bid amount when the RPC succeeds', () => {
    const outcome = classifyBidResult({ success: true }, null, 750);
    expect(outcome).toEqual({ kind: 'success', bidAmount: 750 });
  });
});
