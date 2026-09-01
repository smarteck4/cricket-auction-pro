import { useMemo } from 'react';
import { MatchBall, MatchInnings } from '@/lib/tournament-types';
import { Owner, Player } from '@/lib/types';
import { computeMilestones, Milestone } from '@/lib/match-analysis';
import { TeamLogo } from './ScoreAvatars';
import { Flag, Handshake, Trophy, Zap } from 'lucide-react';

interface MatchMilestonesProps {
  innings: MatchInnings[];
  allBalls: MatchBall[][];
  team1: Owner;
  team2: Owner;
  team1Players: Player[];
  team2Players: Player[];
}

const ICONS: Record<Milestone['kind'], typeof Flag> = {
  team: Trophy,
  partnership: Handshake,
  individual: Zap,
  wicket: Flag,
};

const TONE: Record<Milestone['kind'], string> = {
  team: 'text-primary',
  partnership: 'text-sky-500',
  individual: 'text-amber-500',
  wicket: 'text-destructive',
};

export function useInningsMilestones({
  innings,
  allBalls,
  team1,
  team1Players,
  team2Players,
}: Omit<MatchMilestonesProps, 'team2'>) {
  return useMemo(
    () =>
      innings.map((inn, idx) => {
        const battingIsTeam1 = inn.batting_team_id === team1.id;
        const batPlayers = battingIsTeam1 ? team1Players : team2Players;
        const bowlPlayers = battingIsTeam1 ? team2Players : team1Players;
        return computeMilestones(allBalls[idx] || [], batPlayers, bowlPlayers);
      }),
    [innings, allBalls, team1, team1Players, team2Players],
  );
}

/** Over-by-over milestone log (team 50/100 up, 50 partnerships, last wicket). */
export function MatchMilestones({
  innings,
  allBalls,
  team1,
  team2,
  team1Players,
  team2Players,
}: MatchMilestonesProps) {
  const perInnings = useInningsMilestones({ innings, allBalls, team1, team1Players, team2Players });

  if (!perInnings.some((m) => m.length > 0)) return null;

  return (
    <div className="space-y-4">
      {perInnings.map((list, idx) =>
        list.length ? (
          <div key={innings[idx].id} className="rounded-xl border border-border/40 bg-card p-3">
            <div className="mb-2 flex items-center gap-2">
              <TeamLogo team={innings[idx].batting_team_id === team1.id ? team1 : team2} size={20} />
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Milestones — innings {innings[idx].innings_number}
              </p>
            </div>
            <ul className="space-y-1.5">
              {list.map((m, i) => {
                const Icon = ICONS[m.kind];
                return (
                  <li key={`${m.kind}-${m.label}-${i}`} className="flex items-start gap-2 text-sm">
                    <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${TONE[m.kind]}`} />
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{m.label}</span>{' '}
                      <span className="text-muted-foreground">{m.detail}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{m.overs} ov</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null,
      )}
    </div>
  );
}
