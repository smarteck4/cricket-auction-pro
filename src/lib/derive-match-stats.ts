import { MatchBall, MatchInnings, PlayerMatchStats } from '@/lib/tournament-types';

/**
 * Live stats are derived from the ball-by-ball log so tournament statistics
 * update while a match is in progress (player_match_stats rows are only
 * written after a match is finalised, if at all).
 */
export function deriveStatsFromBalls(
  innings: MatchInnings[],
  balls: MatchBall[],
): PlayerMatchStats[] {
  const inningsById = new Map(innings.map((i) => [i.id, i]));
  const rows = new Map<string, PlayerMatchStats>();

  const blank = (matchId: string, playerId: string, teamId: string): PlayerMatchStats => ({
    id: `derived-${matchId}-${playerId}`,
    match_id: matchId,
    player_id: playerId,
    team_id: teamId,
    runs_scored: 0,
    balls_faced: 0,
    fours: 0,
    sixes: 0,
    overs_bowled: 0,
    runs_conceded: 0,
    wickets_taken: 0,
    maidens: 0,
    catches: 0,
    run_outs: 0,
    stumpings: 0,
    created_at: new Date(0).toISOString(),
  });

  const get = (matchId: string, playerId: string, teamId: string) => {
    const key = `${matchId}:${playerId}`;
    if (!rows.has(key)) rows.set(key, blank(matchId, playerId, teamId));
    return rows.get(key)!;
  };

  // legal balls per bowler for overs, and per-over runs for maidens
  const bowlerLegalBalls = new Map<string, number>();
  const overRuns = new Map<string, number>();
  const overBalls = new Map<string, number>();

  balls.forEach((ball) => {
    const inn = inningsById.get(ball.innings_id);
    if (!inn) return;
    const matchId = inn.match_id;
    const battingTeam = inn.batting_team_id;
    const bowlingTeam = inn.bowling_team_id;

    const isLegal = !ball.extra_type || !['wide', 'no_ball'].includes(ball.extra_type);
    const isBatsmanRun = !ball.extra_type || ball.extra_type === 'no_ball';
    const isBallFaced = ball.extra_type !== 'wide';

    if (ball.batsman_id) {
      const bat = get(matchId, ball.batsman_id, battingTeam);
      const runs = isBatsmanRun ? ball.runs_scored : 0;
      bat.runs_scored += runs;
      if (isBallFaced) bat.balls_faced += 1;
      if (runs === 4) bat.fours += 1;
      if (runs === 6) bat.sixes += 1;
    }

    if (ball.bowler_id) {
      const bowl = get(matchId, ball.bowler_id, bowlingTeam);
      const charged = !ball.extra_type || ball.extra_type === 'wide' || ball.extra_type === 'no_ball';
      bowl.runs_conceded += charged ? ball.runs_scored + ball.extras : 0;
      if (ball.is_wicket && ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket'].includes(ball.wicket_type || '')) {
        bowl.wickets_taken += 1;
      }
      const bKey = `${matchId}:${ball.bowler_id}`;
      if (isLegal) bowlerLegalBalls.set(bKey, (bowlerLegalBalls.get(bKey) || 0) + 1);

      const oKey = `${bKey}:${ball.innings_id}:${ball.over_number}`;
      overRuns.set(oKey, (overRuns.get(oKey) || 0) + (charged ? ball.runs_scored + ball.extras : 0));
      if (isLegal) overBalls.set(oKey, (overBalls.get(oKey) || 0) + 1);
    }

    if (ball.is_wicket && ball.fielder_id) {
      const field = get(matchId, ball.fielder_id, bowlingTeam);
      if (ball.wicket_type === 'caught') field.catches += 1;
      else if (ball.wicket_type === 'run_out') field.run_outs += 1;
      else if (ball.wicket_type === 'stumped') field.stumpings += 1;
    }
  });

  bowlerLegalBalls.forEach((legal, key) => {
    const row = rows.get(key);
    if (row) row.overs_bowled = Math.floor(legal / 6) + (legal % 6) / 10;
  });

  overRuns.forEach((runs, oKey) => {
    if (runs !== 0 || (overBalls.get(oKey) || 0) < 6) return;
    const [matchId, playerId] = oKey.split(':');
    const row = rows.get(`${matchId}:${playerId}`);
    if (row) row.maidens += 1;
  });

  return Array.from(rows.values());
}

/** Stored stats win only for matches that have no derived (ball-by-ball) data. */
export function mergeMatchStats(
  stored: PlayerMatchStats[],
  derived: PlayerMatchStats[],
): PlayerMatchStats[] {
  const derivedMatchIds = new Set(derived.map((d) => d.match_id));
  return [...derived, ...stored.filter((s) => !derivedMatchIds.has(s.match_id))];
}
