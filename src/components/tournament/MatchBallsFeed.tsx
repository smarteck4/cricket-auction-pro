import { MatchBall, MatchInnings } from '@/lib/tournament-types';
import { Player, Owner } from '@/lib/types';

interface MatchBallsFeedProps {
  innings: MatchInnings[];
  allBalls: MatchBall[][];
  team1: Owner;
  team2: Owner;
  players: Player[];
}

const notation = (ball: MatchBall) => {
  if (ball.is_wicket) {
    const total = ball.runs_scored + ball.extras;
    if (ball.extra_type === 'wide') return total > 0 ? `W+${total}Wd` : 'W';
    if (ball.extra_type === 'no_ball') return total > 0 ? `W+${total}Nb` : 'W';
    return total > 0 ? `W+${total}` : 'W';
  }
  if (ball.extra_type === 'wide') return ball.extras > 1 ? `${ball.extras}Wd` : 'Wd';
  if (ball.extra_type === 'no_ball')
    return ball.runs_scored > 0 ? `${ball.runs_scored}+${ball.extras}Nb` : `${ball.extras}Nb`;
  if (ball.extra_type === 'bye') return `${ball.extras}B`;
  if (ball.extra_type === 'leg_bye') return `${ball.extras}Lb`;
  return String(ball.runs_scored);
};

/** Ball-by-ball commentary for every innings of the match (works for completed matches too). */
export function MatchBallsFeed({ innings, allBalls, team1, team2, players }: MatchBallsFeedProps) {
  const name = (id?: string | null) => (id ? players.find((p) => p.id === id)?.name || 'Unknown' : 'Unknown');
  const hasAny = allBalls.some((b) => b && b.length > 0);

  if (!innings.length || !hasAny) {
    return <p className="py-8 text-center text-muted-foreground">No balls recorded</p>;
  }

  return (
    <div className="space-y-5">
      {innings.map((inn, idx) => {
        const balls = allBalls[idx] || [];
        const batTeam = inn.batting_team_id === team1.id ? team1 : team2;
        if (!balls.length) return null;

        const overs = new Map<number, MatchBall[]>();
        balls.forEach((b) => {
          if (!overs.has(b.over_number)) overs.set(b.over_number, []);
          overs.get(b.over_number)!.push(b);
        });

        return (
          <div key={inn.id} className="rounded-xl border border-border/40 overflow-hidden">
            <div className="flex items-center justify-between bg-muted/40 px-3 py-2">
              <span className="text-sm font-bold">
                {batTeam.team_name} · Innings {inn.innings_number}
              </span>
              <span className="text-xs text-muted-foreground">
                {inn.total_runs}/{inn.total_wickets}
              </span>
            </div>
            <div className="divide-y divide-border/40">
              {Array.from(overs.entries())
                .sort((a, b) => b[0] - a[0])
                .map(([overNum, overBalls]) => {
                  const overRuns = overBalls.reduce((s, b) => s + b.runs_scored + b.extras, 0);
                  return (
                    <div key={overNum} className="p-2.5">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-bold">
                          Over {overNum + 1}
                          <span className="ml-2 font-normal text-muted-foreground">
                            {name(overBalls[0]?.bowler_id)}
                          </span>
                        </span>
                        <span className="text-xs font-bold text-primary">{overRuns} runs</span>
                      </div>
                      <div className="space-y-1">
                        {overBalls
                          .slice()
                          .reverse()
                          .map((ball) => (
                            <div
                              key={ball.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-border/30 bg-muted/20 p-2"
                            >
                              <span className="min-w-0 truncate text-sm">
                                <span className="mr-2 text-xs text-muted-foreground">
                                  {ball.over_number}.{ball.ball_number}
                                </span>
                                {name(ball.batsman_id)}
                                {ball.is_wicket && (
                                  <span className="ml-2 text-xs font-semibold text-destructive">
                                    {ball.wicket_type?.replace('_', ' ')}
                                  </span>
                                )}
                              </span>
                              <span
                                className={`inline-flex h-7 min-w-[2rem] shrink-0 items-center justify-center rounded-full px-2 text-xs font-bold ${
                                  ball.is_wicket
                                    ? 'bg-destructive text-white'
                                    : ball.runs_scored >= 4
                                      ? 'bg-primary text-white'
                                      : 'bg-secondary text-secondary-foreground'
                                }`}
                              >
                                {notation(ball)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
