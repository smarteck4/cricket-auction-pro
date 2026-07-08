import { describe, it, expect } from 'vitest';
import {
  calculateTimeRemaining,
  computeServerOffset,
  isBidButtonDisabled,
  isBidWindowClosed,
} from './auction-timer';

/**
 * These tests simulate a bidder's device clock being skewed relative to the
 * server and verify the Bid button stays ENABLED throughout the active bidding
 * period — the exact regression that showed every owner a disabled
 * "Timer Expired" button.
 */

const TIMER_DURATION = 30; // seconds
const SERVER_START_ISO = '2026-07-08T12:00:00.000Z';
const serverStartMs = new Date(SERVER_START_ISO).getTime();

/** Model one round-trip time sync from a skewed device and return its offset. */
function syncedOffset(deviceSkewMs: number, latencyMs = 40): number {
  // Real time at which the client sends the sync request.
  const realSendMs = serverStartMs + 5_000; // 5s into the auction
  const t0 = realSendMs + deviceSkewMs; // device clock reading when sending
  const t1 = t0 + latencyMs; // device clock reading when reply arrives
  // Server timestamps mid-flight, at real time.
  const serverIso = new Date(realSendMs + latencyMs / 2).toISOString();
  return computeServerOffset(t0, t1, serverIso);
}

/** Seconds remaining as the UI would compute it for a skewed, synced device. */
function remainingFor(deviceSkewMs: number, secondsIntoAuction: number): number {
  const offset = syncedOffset(deviceSkewMs);
  const realNowMs = serverStartMs + secondsIntoAuction * 1000;
  const deviceNowMs = realNowMs + deviceSkewMs;
  return calculateTimeRemaining({
    timerStartedAt: SERVER_START_ISO,
    timerDuration: TIMER_DURATION,
    isActive: true,
    nowMs: deviceNowMs,
    serverOffsetMs: offset,
  });
}

describe('clock skew — bid button stays enabled during active bidding', () => {
  const skews = [
    { label: 'no skew', ms: 0 },
    { label: 'device 2 minutes ahead', ms: 120_000 },
    { label: 'device 10 minutes ahead', ms: 600_000 },
    { label: 'device 1 hour ahead', ms: 3_600_000 },
    { label: 'device 2 minutes behind', ms: -120_000 },
    { label: 'device 1 hour behind', ms: -3_600_000 },
  ];

  for (const skew of skews) {
    it(`keeps the button enabled mid-auction (${skew.label})`, () => {
      const remaining = remainingFor(skew.ms, 10); // 10s into a 30s timer
      // After syncing to the server, the countdown must reflect real remaining time.
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeCloseTo(20, 0);

      const disabled = isBidButtonDisabled({
        bidding: false,
        clockSynced: true,
        timeRemaining: remaining,
        canAfford: true,
      });
      expect(disabled).toBe(false);
    });
  }

  it('does NOT lock the button before the clock has synced, even if the device clock is far ahead', () => {
    // Device clock is 10 minutes ahead and we have not synced yet (offset 0).
    const deviceNowMs = serverStartMs + 10_000 + 600_000;
    const naiveRemaining = calculateTimeRemaining({
      timerStartedAt: SERVER_START_ISO,
      timerDuration: TIMER_DURATION,
      isActive: true,
      nowMs: deviceNowMs,
      serverOffsetMs: 0,
    });
    // Uncorrected, the countdown wrongly reads 0...
    expect(naiveRemaining).toBe(0);
    // ...but because the clock is not yet synced we must NOT gate on it.
    expect(isBidWindowClosed(false, naiveRemaining)).toBe(false);
    expect(
      isBidButtonDisabled({ bidding: false, clockSynced: false, timeRemaining: naiveRemaining, canAfford: true }),
    ).toBe(false);
  });

  it('locks the button only once the clock is synced AND time is genuinely up', () => {
    const remaining = remainingFor(600_000, 30); // exactly at expiry, device ahead
    expect(remaining).toBe(0);
    expect(isBidWindowClosed(true, remaining)).toBe(true);
    expect(
      isBidButtonDisabled({ bidding: false, clockSynced: true, timeRemaining: remaining, canAfford: true }),
    ).toBe(true);
  });

  it('still disables when the owner cannot afford the bid, regardless of the timer', () => {
    expect(
      isBidButtonDisabled({ bidding: false, clockSynced: true, timeRemaining: 25, canAfford: false }),
    ).toBe(true);
  });

  it('disables while a bid RPC is in flight', () => {
    expect(
      isBidButtonDisabled({ bidding: true, clockSynced: true, timeRemaining: 25, canAfford: true }),
    ).toBe(true);
  });
});
