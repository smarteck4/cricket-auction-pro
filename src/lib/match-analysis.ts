import { Match, MatchBall, MatchInnings } from '@/lib/tournament-types';
import { Player } from '@/lib/types';

/* ============================================================
   Shared cricket analysis helpers used by the Match Centre UI
   and the ESPNcricinfo-style PDF export.
   ============================================================ */

export const isLegalDelivery = (b: MatchBall) =>
  !b.extra_type || !['wide', 'no_ball'].includes(b.extra_type);

export const legalBallsOf = (balls: MatchBall[]) => balls.filter(isLegalDelivery).length;

export const oversText = (legalBalls: number) => `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;

const shortName = (players: Player[], id?: string | null) =>
  (id ? players.find((p) => p.id === id)?.name : '') || '';

export interface FowRow {
  wicketNum: number;
  score: number;
  wicketsAtFall: number;
  batsmanName: string;
  batsmanId: string | null;
  overs: string;
  legalBalls: number;
  /** Runs added in the partnership that just ended. */
  partnership: number;
  /** Balls consumed by that partnership. */
  partnershipBalls: number;
  dismissal: string;
  bowlerName: string;
}

const dismissalText = (ball: MatchBall, bowlPlayers: Player[]) => {
  const bowler = shortName(bowlPlayers, ball.bowler_id).split(' ').pop() || '';
  const fielder = shortName(bowlPlayers, ball.fielder_id).split(' ').pop() || '';
  switch (ball.wicket_type) {
    case 'bowled':
      return `b ${bowler}`;
    case 'caught':
      return ball.fielder_id === ball.bowler_id ? `c & b ${bowler}` : `c ${fielder} b ${bowler}`;
    case 'lbw':
      return `lbw b ${bowler}`;
    case 'stumped':
      return `st ${fielder} b ${bowler}`;
    case 'run_out':
      return fielder ? `run out (${fielder})` : 'run out';
    case 'hit_wicket':
      return `hit wicket b ${bowler}`;
    default:
      return ball.wicket_type || 'out';
  }
};

/** International-style fall of wickets, including partnership for each stand. */
export function computeFallOfWickets(
  balls: MatchBall[],
  batPlayers: Player[],
  bowlPlayers: Player[],
): FowRow[] {
  const rows: FowRow[] = [];
  let runs = 0;
  let legal = 0;
  let wickets = 0;
  let lastScore = 0;
  let lastBalls = 0;

  balls.forEach((ball) => {
    runs += ball.runs_scored + ball.extras;
    if (isLegalDelivery(ball)) legal++;
    if (!ball.is_wicket) return;
    wickets++;
    rows.push({
      wicketNum: wickets,
      score: runs,
      wicketsAtFall: wickets,
      batsmanId: ball.batsman_id ?? null,
      batsmanName: shortName(batPlayers, ball.batsman_id) || 'Unknown',
      overs: oversText(legal),
      legalBalls: legal,
      partnership: runs - lastScore,
      partnershipBalls: legal - lastBalls,
      dismissal: dismissalText(ball, bowlPlayers),
      bowlerName: shortName(bowlPlayers, ball.bowler_id),
    });
    lastScore = runs;
    lastBalls = legal;
  });

  return rows;
}

export type MilestoneKind = 'team' | 'partnership' | 'wicket' | 'individual';

export interface Milestone {
  /** 1-based over in which the milestone happened (matches chart X axis). */
  over: number;
  overs: string;
  score: number;
  kind: MilestoneKind;
  label: string;
  detail: string;
}

/**
 * Over-by-over milestones: team hundreds/fifties, 50+ partnerships,
 * individual fifties/hundreds and the final wicket.
 */
export function computeMilestones(
  balls: MatchBall[],
  batPlayers: Player[],
  bowlPlayers: Player[],
): Milestone[] {
  const out: Milestone[] = [];
  let runs = 0;
  let legal = 0;
  let wickets = 0;
  let nextTeamMark = 50;
  let standRuns = 0;
  let standBalls = 0;
  let standFlagged = false;
  const batTotals = new Map<string, number>();
  const batMark = new Map<string, number>();

  balls.forEach((ball, idx) => {
    const legalBall = isLegalDelivery(ball);
    const batsmanRun = !ball.extra_type || ball.extra_type === 'no_ball' ? ball.runs_scored : 0;
    runs += ball.runs_scored + ball.extras;
    standRuns += ball.runs_scored + ball.extras;
    if (legalBall) {
      legal++;
      standBalls++;
    }
    const over = ball.over_number + 1;

    while (runs >= nextTeamMark) {
      out.push({
        over,
        overs: oversText(legal),
        score: runs,
        kind: 'team',
        label: `${nextTeamMark} up`,
        detail: `Team ${nextTeamMark} in ${oversText(legal)} ov (${wickets} down)`,
      });
      nextTeamMark += 50;
    }

    if (ball.batsman_id && batsmanRun > 0) {
      const total = (batTotals.get(ball.batsman_id) || 0) + batsmanRun;
      batTotals.set(ball.batsman_id, total);
      const mark = batMark.get(ball.batsman_id) || 50;
      if (total >= mark) {
        out.push({
          over,
          overs: oversText(legal),
          score: runs,
          kind: 'individual',
          label: `${shortName(batPlayers, ball.batsman_id).split(' ').pop() || 'Batter'} ${mark}`,
          detail: `${shortName(batPlayers, ball.batsman_id)} reaches ${mark}`,
        });
        batMark.set(ball.batsman_id, mark + 50);
      }
    }

    if (!standFlagged && standRuns >= 50) {
      standFlagged = true;
      out.push({
        over,
        overs: oversText(legal),
        score: runs,
        kind: 'partnership',
        label: '50 partnership',
        detail: `50-run stand off ${standBalls} balls`,
      });
    }

    if (ball.is_wicket) {
      wickets++;
      standRuns = 0;
      standBalls = 0;
      standFlagged = false;
      const isLast = wickets === 10 || idx === balls.length - 1;
      if (isLast) {
        out.push({
          over,
          overs: oversText(legal),
          score: runs,
          kind: 'wicket',
          label: 'Last wicket',
          detail: `${shortName(batPlayers, ball.batsman_id)} ${dismissalText(ball, bowlPlayers)} — ${runs}/${wickets}`,
        });
      }
    }
  });

  return out;
}

export type ChaseState = 'not_started' | 'in_progress' | 'won' | 'lost' | 'tied' | 'no_result';

export interface ChaseInfo {
  target: number;
  runs: number;
  wickets: number;
  wicketsLeft: number;
  ballsBowled: number;
  ballsAllotted: number;
  ballsLeft: number;
  runsNeeded: number;
  /** null when a required rate cannot be computed (no balls left / chase over). */
  rrr: number | null;
  crr: number;
  progress: number;
  state: ChaseState;
  /** True when the chasing side got fewer overs than the full quota. */
  shortened: boolean;
  oversAllottedText: string;
  message: string;
}

/**
 * Target / required-runs maths for the chasing innings with the usual
 * edge cases handled: no result, abandoned matches, shortened chases,
 * all out, and completed chases.
 */
export function computeChase(params: {
  match: Pick<Match, 'status' | 'overs_per_innings'>;
  innings: MatchInnings[];
  allBalls: MatchBall[][];
  chasingTeamName: string;
}): ChaseInfo | null {
  const { match, innings, allBalls, chasingTeamName } = params;
  if (innings.length < 2) return null;

  const chaseIdx = innings.length - 1;
  const chase = innings[chaseIdx];
  const setInn = innings[chaseIdx - 1];
  if (!chase || !setInn) return null;

  const fullBalls = Math.max(1, Math.round((match.overs_per_innings || 0) * 6));
  const setBalls = legalBallsOf(allBalls[chaseIdx - 1] || []);
  // Innings closed early without being bowled out ⇒ overs were reduced.
  const setInningsShortened =
    setInn.is_completed && setInn.total_wickets < 10 && setBalls > 0 && setBalls < fullBalls;
  const ballsAllotted = setInningsShortened ? setBalls : fullBalls;

  const target = setInn.total_runs + 1;
  const chaseBalls = allBalls[chaseIdx] || [];
  const ballsBowled = legalBallsOf(chaseBalls);
  const ballsLeft = Math.max(0, ballsAllotted - ballsBowled);
  const runs = chase.total_runs;
  const wickets = Math.min(10, chase.total_wickets);
  const wicketsLeft = Math.max(0, 10 - wickets);
  const runsNeeded = Math.max(0, target - runs);
  const crr = ballsBowled > 0 ? runs / (ballsBowled / 6) : 0;
  const progress = target > 1 ? Math.min(100, (runs / (target - 1 || 1)) * 100) : runs > 0 ? 100 : 0;

  let state: ChaseState;
  if (match.status === 'cancelled') state = 'no_result';
  else if (runs >= target) state = 'won';
  else if (wicketsLeft === 0 || ballsLeft === 0 || chase.is_completed) {
    state = runs === target - 1 ? 'tied' : 'lost';
  } else if (ballsBowled === 0) state = 'not_started';
  else state = 'in_progress';

  const chaseLive = state === 'in_progress' || state === 'not_started';
  const rrr = chaseLive && ballsLeft > 0 ? runsNeeded / (ballsLeft / 6) : null;

  let message: string;
  switch (state) {
    case 'no_result':
      message = 'No result — match abandoned';
      break;
    case 'won':
      message = `${chasingTeamName} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? '' : 's'} (${ballsLeft} ball${ballsLeft === 1 ? '' : 's'} left)`;
      break;
    case 'tied':
      message = `Match tied — ${runs}/${wickets}`;
      break;
    case 'lost':
      message = `${chasingTeamName} fell ${target - runs} run${target - runs === 1 ? '' : 's'} short`;
      break;
    case 'not_started':
      message = `${chasingTeamName} need ${runsNeeded} runs from ${ballsLeft} balls to win`;
      break;
    default:
      message = `Need ${runsNeeded} run${runsNeeded === 1 ? '' : 's'} from ${ballsLeft} ball${ballsLeft === 1 ? '' : 's'} · ${wicketsLeft} wicket${wicketsLeft === 1 ? '' : 's'} in hand`;
  }

  return {
    target,
    runs,
    wickets,
    wicketsLeft,
    ballsBowled,
    ballsAllotted,
    ballsLeft,
    runsNeeded,
    rrr,
    crr,
    progress,
    state,
    shortened: setInningsShortened,
    oversAllottedText: oversText(ballsAllotted),
    message,
  };
}
