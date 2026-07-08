import { describe, it, expect } from 'vitest';
import {
  applyAuctionRealtimeEvent,
  initialOwnerScreenState,
  calculateTimeRemaining,
  type AuctionSnapshot,
  type OwnerScreenState,
} from './auction-timer';

/**
 * End-to-end style simulation of real-time bidding.
 *
 * Supabase broadcasts every current_auction change to all subscribed clients,
 * and each owner's screen reacts by running the SAME reducer. This test wires up
 * a mock broadcast bus with several owner screens and verifies that after every
 * event, ALL screens agree on:
 *   - the auction timer (reset on each new bid),
 *   - the leading-bidder logo (swaps to the highest bidder), and
 *   - instant player appearance (the player on the block updates everywhere).
 */

interface TeamOwner {
  id: string;
  teamName: string;
  logoUrl: string;
}

const OWNERS: TeamOwner[] = [
  { id: 'owner-1', teamName: 'Royal Strikers', logoUrl: '/logos/royal.png' },
  { id: 'owner-2', teamName: 'Coastal Kings', logoUrl: '/logos/coastal.png' },
  { id: 'owner-3', teamName: 'Desert Falcons', logoUrl: '/logos/falcons.png' },
];

const logoFor = (bidderId: string | null) =>
  bidderId ? OWNERS.find((o) => o.id === bidderId)?.logoUrl ?? null : null;

/** A single owner's screen: holds reducer state + the derived UI it renders. */
class OwnerScreen {
  state: OwnerScreenState = initialOwnerScreenState();
  currentPlayerId: string | null = null;
  leadingLogo: string | null = null;
  chimes = 0;
  timerResets = 0;

  receive(snapshot: AuctionSnapshot) {
    const { state, effects } = applyAuctionRealtimeEvent(this.state, snapshot);
    this.state = state;

    if (effects.playerChanged) this.currentPlayerId = snapshot.playerId;
    if (effects.bidderChanged) this.leadingLogo = logoFor(snapshot.currentBidderId);
    if (effects.newBid) this.chimes += 1;
    if (effects.timerReset) this.timerResets += 1;
  }

  /** Server-aligned seconds remaining on this screen (clocks assumed in sync here). */
  secondsRemaining(nowMs: number) {
    if (!this.state.auction?.timerStartedAt) return 0;
    return calculateTimeRemaining({
      timerStartedAt: this.state.auction.timerStartedAt,
      timerDuration: 30,
      isActive: this.state.auction.isActive,
      nowMs,
      serverOffsetMs: 0,
    });
  }
}

/** Mock realtime channel that fans a broadcast out to every subscribed screen. */
class BroadcastBus {
  private screens: OwnerScreen[] = [];
  subscribe(screen: OwnerScreen) {
    this.screens.push(screen);
  }
  broadcast(snapshot: AuctionSnapshot) {
    for (const s of this.screens) s.receive(snapshot);
  }
  get all() {
    return this.screens;
  }
}

const AUCTION_ID = 'auction-1';
const t = (iso: string) => new Date(iso).getTime();

describe('real-time bidding — every owner screen stays in sync', () => {
  it('propagates player appearance, leading-bidder logo, and timer resets to all screens', () => {
    const bus = new BroadcastBus();
    const screens = OWNERS.map(() => new OwnerScreen());
    screens.forEach((s) => bus.subscribe(s));

    // 1) Admin puts Player A on the block.
    bus.broadcast({
      auctionId: AUCTION_ID,
      playerId: 'player-A',
      currentBid: 0,
      currentBidderId: null,
      timerStartedAt: '2026-07-08T12:00:00.000Z',
      isActive: true,
    });

    // Instant player appearance on EVERY screen.
    for (const s of bus.all) {
      expect(s.currentPlayerId).toBe('player-A');
      expect(s.leadingLogo).toBeNull();
      expect(s.timerResets).toBe(1);
      expect(s.secondsRemaining(t('2026-07-08T12:00:10.000Z'))).toBeCloseTo(20, 0);
    }

    // 2) Owner 1 bids; timer restarts.
    bus.broadcast({
      auctionId: AUCTION_ID,
      playerId: 'player-A',
      currentBid: 100,
      currentBidderId: 'owner-1',
      timerStartedAt: '2026-07-08T12:00:12.000Z',
      isActive: true,
    });

    for (const s of bus.all) {
      expect(s.leadingLogo).toBe('/logos/royal.png'); // logo swapped everywhere
      expect(s.chimes).toBe(1); // new-bid chime fired once per screen
      expect(s.timerResets).toBe(2); // timer reset on the bid
      // Countdown re-anchored to the new start time.
      expect(s.secondsRemaining(t('2026-07-08T12:00:22.000Z'))).toBeCloseTo(20, 0);
    }

    // 3) Owner 2 outbids; leading logo swaps again.
    bus.broadcast({
      auctionId: AUCTION_ID,
      playerId: 'player-A',
      currentBid: 150,
      currentBidderId: 'owner-2',
      timerStartedAt: '2026-07-08T12:00:18.000Z',
      isActive: true,
    });

    for (const s of bus.all) {
      expect(s.leadingLogo).toBe('/logos/coastal.png');
      expect(s.chimes).toBe(2);
      expect(s.timerResets).toBe(3);
    }

    // 4) Player A sold; Player B appears instantly on all screens.
    bus.broadcast({
      auctionId: AUCTION_ID,
      playerId: 'player-B',
      currentBid: 0,
      currentBidderId: null,
      timerStartedAt: '2026-07-08T12:00:30.000Z',
      isActive: true,
    });

    for (const s of bus.all) {
      expect(s.currentPlayerId).toBe('player-B');
      expect(s.leadingLogo).toBeNull(); // fresh player has no leading bidder
      expect(s.chimes).toBe(2); // presenting a player is not a "new bid"
      expect(s.timerResets).toBe(4);
    }

    // Every screen converged to identical auction state.
    const snapshots = bus.all.map((s) => JSON.stringify(s.state.auction));
    expect(new Set(snapshots).size).toBe(1);
  });

  it('does not re-chime when the same bid broadcast is delivered twice (dedupe)', () => {
    const screen = new OwnerScreen();
    const bid: AuctionSnapshot = {
      auctionId: AUCTION_ID,
      playerId: 'player-A',
      currentBid: 100,
      currentBidderId: 'owner-1',
      timerStartedAt: '2026-07-08T12:00:12.000Z',
      isActive: true,
    };
    screen.receive(bid);
    screen.receive(bid); // duplicate delivery
    expect(screen.chimes).toBe(1);
  });

  it('a late joiner who receives only the latest snapshot still shows the correct leader and player', () => {
    const latecomer = new OwnerScreen();
    latecomer.receive({
      auctionId: AUCTION_ID,
      playerId: 'player-A',
      currentBid: 150,
      currentBidderId: 'owner-2',
      timerStartedAt: '2026-07-08T12:00:18.000Z',
      isActive: true,
    });
    expect(latecomer.currentPlayerId).toBe('player-A');
    expect(latecomer.leadingLogo).toBe('/logos/coastal.png');
    expect(latecomer.secondsRemaining(t('2026-07-08T12:00:28.000Z'))).toBeCloseTo(20, 0);
  });
});
