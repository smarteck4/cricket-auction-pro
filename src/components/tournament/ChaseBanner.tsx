import { MatchInnings, MatchBall } from '@/lib/tournament-types';
import { Owner } from '@/lib/types';
import { TeamLogo } from './ScoreAvatars';
import { Target } from 'lucide-react';

interface ChaseBannerProps {
  innings: MatchInnings[];
  allBalls: MatchBall[][];
  oversPerInnings: number;
  team1: Owner;
  team2: Owner;
}

const legalBallsOf = (balls: MatchBall[]) =>
  balls.filter((b) => !b.extra_type || !['wide', 'no_ball'].includes(b.extra_type)).length;

/**
 * Automatic target / chase progress banner shown while the chasing innings is under way.
 */
export function ChaseBanner({ innings, allBalls, oversPerInnings, team1, team2 }: ChaseBannerProps) {
  if (innings.length < 2) return null;

  // The chase is always the last innings of the match (2nd for limited overs, 4th for long form).
  const chaseIdx = innings.length - 1;
  const chase = innings[chaseIdx];
  const setInn = innings[chaseIdx - 1];
  if (!chase || !setInn) return null;

  const target = setInn.total_runs + 1;
  const chaseBalls = allBalls[chaseIdx] || [];
  const ballsBowled = legalBallsOf(chaseBalls);
  const ballsLeft = Math.max(0, oversPerInnings * 6 - ballsBowled);
  const runsNeeded = Math.max(0, target - chase.total_runs);
  const wicketsLeft = Math.max(0, 10 - chase.total_wickets);
  const rrr = ballsLeft > 0 ? (runsNeeded / (ballsLeft / 6)) : 0;
  const crr = ballsBowled > 0 ? chase.total_runs / (ballsBowled / 6) : 0;
  const progress = Math.min(100, target > 0 ? (chase.total_runs / target) * 100 : 0);

  const chasingTeam = chase.batting_team_id === team1.id ? team1 : team2;
  const finished = chase.is_completed || runsNeeded === 0 || ballsLeft === 0 || wicketsLeft === 0;

  return (
    <div className="rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 min-w-0">
          <TeamLogo team={chasingTeam} size={26} />
          <span className="truncate text-sm font-bold">{chasingTeam.team_name}</span>
          <span className="text-xs text-muted-foreground">
            {chase.total_runs}/{chase.total_wickets}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
          <Target className="h-3.5 w-3.5" /> Target {target}
        </span>
      </div>

      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>

      <p className="mt-2.5 text-sm font-semibold">
        {finished
          ? `Chase closed — ${chase.total_runs}/${chase.total_wickets} of ${target}`
          : `Need ${runsNeeded} run${runsNeeded === 1 ? '' : 's'} from ${ballsLeft} ball${ballsLeft === 1 ? '' : 's'} · ${wicketsLeft} wicket${wicketsLeft === 1 ? '' : 's'} in hand`}
      </p>

      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'CRR', value: crr.toFixed(2) },
          { label: 'REQ RR', value: finished ? '—' : rrr.toFixed(2) },
          { label: 'Overs left', value: `${Math.floor(ballsLeft / 6)}.${ballsLeft % 6}` },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border/40 bg-card/60 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="text-sm font-bold">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
