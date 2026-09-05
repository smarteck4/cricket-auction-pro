// Auto-selection of a playing XI (or any squad size) from a team's purchased
// roster: strongest players by auction category, balanced across roles.

import { Player, PlayerCategory, PlayerRole } from '@/lib/types';

const CATEGORY_WEIGHT: Record<PlayerCategory, number> = {
  platinum: 4000,
  gold: 3000,
  silver: 2000,
  emerging: 1000,
};

/** Higher is better. Category dominates; career stats break ties. */
export function playerStrength(p: Player): number {
  const cat = CATEGORY_WEIGHT[p.category] ?? 0;
  const runs = (p.total_runs ?? 0) / 10;
  const wickets = (p.wickets ?? 0) * 3;
  const sr = (p.strike_rate ?? 0) / 20;
  return cat + runs + wickets + sr;
}

export interface PickXIOptions {
  /** Captain is always included in the squad when present in the roster. */
  captainId?: string | null;
}

/** Minimum role quotas for a squad of `size` players. */
export function roleQuotas(size: number): { keeper: number; bowler: number; batsman: number } {
  return {
    keeper: 1,
    bowler: Math.max(1, Math.floor(size / 3)),
    batsman: Math.max(1, Math.floor(size / 3)),
  };
}

const isBowlerish = (r: PlayerRole) => r === 'bowler' || r === 'all_rounder';
const isBatterish = (r: PlayerRole) => r === 'batsman' || r === 'all_rounder';

/**
 * Pick the best `size` players from `roster`, honouring role quotas
 * (a wicket-keeper, plus a third bowlers and a third batters) and always
 * keeping the captain. Returns players ordered strongest first.
 */
export function pickPlayingXI(roster: Player[], size: number, options: PickXIOptions = {}): Player[] {
  const ranked = [...roster].sort((a, b) => playerStrength(b) - playerStrength(a) || a.name.localeCompare(b.name));
  if (size <= 0) return [];
  if (ranked.length <= size) return ranked;

  const picked: Player[] = [];
  const take = (p: Player | undefined) => {
    if (p && picked.length < size && !picked.some((x) => x.id === p.id)) picked.push(p);
  };
  const remaining = () => ranked.filter((p) => !picked.some((x) => x.id === p.id));

  // 1. Captain first.
  if (options.captainId) take(ranked.find((p) => p.id === options.captainId));

  const quotas = roleQuotas(size);

  // 2. Wicket-keeper(s).
  const keepers = picked.filter((p) => p.player_role === 'wicket_keeper').length;
  for (let i = keepers; i < quotas.keeper; i++) {
    take(remaining().find((p) => p.player_role === 'wicket_keeper'));
  }

  // 3. Bowling strength.
  const countBowlers = () => picked.filter((p) => isBowlerish(p.player_role)).length;
  while (countBowlers() < quotas.bowler && picked.length < size) {
    const next = remaining().find((p) => isBowlerish(p.player_role));
    if (!next) break;
    take(next);
  }

  // 4. Batting strength.
  const countBatters = () => picked.filter((p) => isBatterish(p.player_role)).length;
  while (countBatters() < quotas.batsman && picked.length < size) {
    const next = remaining().find((p) => isBatterish(p.player_role));
    if (!next) break;
    take(next);
  }

  // 5. Fill the rest with the strongest available players.
  for (const p of remaining()) {
    if (picked.length >= size) break;
    take(p);
  }

  return picked.sort((a, b) => playerStrength(b) - playerStrength(a) || a.name.localeCompare(b.name));
}

/** Convenience: suggested captain = strongest player in the roster. */
export function suggestCaptain(roster: Player[]): Player | null {
  if (roster.length === 0) return null;
  return [...roster].sort((a, b) => playerStrength(b) - playerStrength(a))[0];
}
