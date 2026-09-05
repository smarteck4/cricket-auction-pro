import { describe, expect, it } from 'vitest';
import { pickPlayingXI, playerStrength, roleQuotas, suggestCaptain } from './playing-xi';
import { Player, PlayerCategory, PlayerRole } from './types';

const mk = (
  id: string,
  category: PlayerCategory,
  player_role: PlayerRole,
  extra: Partial<Player> = {},
): Player =>
  ({
    id,
    name: id,
    age: 25,
    nationality: 'India',
    profile_picture_url: null,
    category,
    player_role,
    batting_hand: 'right',
    total_matches: 10,
    total_runs: 100,
    highest_score: 50,
    strike_rate: 120,
    wickets: 5,
    bowling_average: 20,
    economy_rate: 7,
    best_bowling: null,
    auction_status: 'sold',
    base_price: 100,
    created_at: '',
    updated_at: '',
    fifties: 0,
    centuries: 0,
    ...extra,
  }) as Player;

describe('playerStrength', () => {
  it('ranks higher categories above lower ones', () => {
    expect(playerStrength(mk('a', 'platinum', 'batsman'))).toBeGreaterThan(
      playerStrength(mk('b', 'gold', 'batsman')),
    );
    expect(playerStrength(mk('c', 'silver', 'batsman'))).toBeGreaterThan(
      playerStrength(mk('d', 'emerging', 'batsman')),
    );
  });

  it('uses stats to break ties inside a category', () => {
    const better = mk('a', 'gold', 'batsman', { total_runs: 900 });
    const worse = mk('b', 'gold', 'batsman', { total_runs: 10 });
    expect(playerStrength(better)).toBeGreaterThan(playerStrength(worse));
  });
});

describe('roleQuotas', () => {
  it('always requires a keeper and scales bowlers/batters with size', () => {
    expect(roleQuotas(11)).toEqual({ keeper: 1, bowler: 3, batsman: 3 });
    expect(roleQuotas(5)).toEqual({ keeper: 1, bowler: 1, batsman: 1 });
  });
});

describe('pickPlayingXI', () => {
  const roster: Player[] = [
    mk('plat-bat', 'platinum', 'batsman'),
    mk('plat-bat2', 'platinum', 'batsman'),
    mk('gold-bat', 'gold', 'batsman'),
    mk('gold-bowl', 'gold', 'bowler'),
    mk('silver-bowl', 'silver', 'bowler'),
    mk('silver-ar', 'silver', 'all_rounder'),
    mk('emerging-keeper', 'emerging', 'wicket_keeper'),
    mk('emerging-bowl', 'emerging', 'bowler'),
  ];

  it('returns the whole roster when it is not bigger than the squad size', () => {
    expect(pickPlayingXI(roster.slice(0, 4), 5)).toHaveLength(4);
  });

  it('picks exactly the requested number of players', () => {
    expect(pickPlayingXI(roster, 5)).toHaveLength(5);
  });

  it('always includes a wicket-keeper even if weak', () => {
    const xi = pickPlayingXI(roster, 5);
    expect(xi.some((p) => p.player_role === 'wicket_keeper')).toBe(true);
  });

  it('meets the bowling quota', () => {
    const xi = pickPlayingXI(roster, 6);
    const bowlers = xi.filter((p) => p.player_role === 'bowler' || p.player_role === 'all_rounder');
    expect(bowlers.length).toBeGreaterThanOrEqual(roleQuotas(6).bowler);
  });

  it('always keeps the nominated captain', () => {
    const xi = pickPlayingXI(roster, 5, { captainId: 'emerging-bowl' });
    expect(xi.map((p) => p.id)).toContain('emerging-bowl');
  });

  it('never duplicates a player', () => {
    const xi = pickPlayingXI(roster, 7, { captainId: 'emerging-keeper' });
    expect(new Set(xi.map((p) => p.id)).size).toBe(xi.length);
  });

  it('returns nothing for a zero size', () => {
    expect(pickPlayingXI(roster, 0)).toEqual([]);
  });
});

describe('suggestCaptain', () => {
  it('suggests the strongest player', () => {
    const best = suggestCaptain([mk('a', 'gold', 'batsman'), mk('b', 'platinum', 'bowler')]);
    expect(best?.id).toBe('b');
  });

  it('returns null for an empty roster', () => {
    expect(suggestCaptain([])).toBeNull();
  });
});
