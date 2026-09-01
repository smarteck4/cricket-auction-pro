import { useMemo } from 'react';
import { MatchBall, MatchInnings } from '@/lib/tournament-types';
import { Owner, Player } from '@/lib/types';
import { computeFallOfWickets } from '@/lib/match-analysis';
import { TeamLogo } from './ScoreAvatars';

interface FallOfWicketsProps {
  innings: MatchInnings[];
  allBalls: MatchBall[][];
  team1: Owner;
  team2: Owner;
  team1Players: Player[];
  team2Players: Player[];
}

/** International broadcast style Fall of Wickets table, live as balls arrive. */
export function FallOfWickets({
  innings,
  allBalls,
  team1,
  team2,
  team1Players,
  team2Players,
}: FallOfWicketsProps) {
  const blocks = useMemo(
    () =>
      innings.map((inn, idx) => {
        const battingIsTeam1 = inn.batting_team_id === team1.id;
        const batPlayers = battingIsTeam1 ? team1Players : team2Players;
        const bowlPlayers = battingIsTeam1 ? team2Players : team1Players;
        return {
          inn,
          team: battingIsTeam1 ? team1 : team2,
          rows: computeFallOfWickets(allBalls[idx] || [], batPlayers, bowlPlayers),
        };
      }),
    [innings, allBalls, team1, team2, team1Players, team2Players],
  );

  if (!blocks.some((b) => b.rows.length > 0)) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Fall of wickets appears as soon as the first wicket falls
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {blocks.map(
        (b) =>
          b.rows.length > 0 && (
            <div key={b.inn.id} className="overflow-hidden rounded-xl border border-border/40">
              <div className="flex items-center justify-between gap-2 bg-muted/40 px-3 py-2">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <TeamLogo team={b.team} size={22} />
                  <span className="truncate text-sm font-bold">{b.team.team_name}</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Fall of wickets
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-border/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 text-left">Wkt</th>
                      <th className="px-3 py-2 text-left">Score</th>
                      <th className="px-3 py-2 text-left">Batter</th>
                      <th className="px-3 py-2 text-left">Dismissal</th>
                      <th className="px-3 py-2 text-right">Over</th>
                      <th className="px-3 py-2 text-right">Partnership</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, i) => (
                      <tr
                        key={r.wicketNum}
                        className={`border-b border-border/30 last:border-0 ${i % 2 ? 'bg-muted/20' : ''}`}
                      >
                        <td className="px-3 py-2 font-bold">{r.wicketNum}</td>
                        <td className="px-3 py-2 font-bold">
                          {r.score}-{r.wicketsAtFall}
                        </td>
                        <td className="px-3 py-2">{r.batsmanName}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{r.dismissal}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.overs}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.partnership}
                          <span className="text-xs text-muted-foreground"> ({r.partnershipBalls})</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ),
      )}
    </div>
  );
}
