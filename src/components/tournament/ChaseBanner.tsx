import { Match, MatchInnings, MatchBall } from '@/lib/tournament-types';
import { Owner } from '@/lib/types';
import { TeamLogo } from './ScoreAvatars';
import { Target } from 'lucide-react';
import { computeChase } from '@/lib/match-analysis';

interface ChaseBannerProps {
  innings: MatchInnings[];
  allBalls: MatchBall[][];
  oversPerInnings: number;
  team1: Owner;
  team2: Owner;
  matchStatus?: Match['status'];
}

/**
 * Automatic target / chase progress banner with validated edge cases
 * (no result, shortened chases, all out, completed chases).
 */
export function ChaseBanner({
  innings,
  allBalls,
  oversPerInnings,
  team1,
  team2,
  matchStatus = 'live',
}: ChaseBannerProps) {
  if (innings.length < 2) return null;

  const chase = innings[innings.length - 1];
  const chasingTeam = chase.batting_team_id === team1.id ? team1 : team2;

  const info = computeChase({
    match: { status: matchStatus, overs_per_innings: oversPerInnings },
    innings,
    allBalls,
    chasingTeamName: chasingTeam.team_name,
  });
  if (!info) return null;

  const live = info.state === 'in_progress' || info.state === 'not_started';

  return (
    <div className="rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-2">
          <TeamLogo team={chasingTeam} size={26} />
          <span className="truncate text-sm font-bold">{chasingTeam.team_name}</span>
          <span className="text-xs text-muted-foreground">
            {info.runs}/{info.wickets}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
          <Target className="h-3.5 w-3.5" /> Target {info.target}
        </span>
      </div>

      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${info.progress}%` }} />
      </div>

      <p className="mt-2.5 text-sm font-semibold">{info.message}</p>
      {info.shortened && (
        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-amber-500">
          Shortened chase — {info.oversAllottedText} overs allotted
        </p>
      )}

      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'CRR', value: info.crr.toFixed(2) },
          { label: 'REQ RR', value: info.rrr === null ? '—' : info.rrr.toFixed(2) },
          {
            label: 'Overs left',
            value: live ? `${Math.floor(info.ballsLeft / 6)}.${info.ballsLeft % 6}` : '—',
          },
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
