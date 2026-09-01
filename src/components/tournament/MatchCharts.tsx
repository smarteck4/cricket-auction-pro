import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { MatchInnings, MatchBall } from '@/lib/tournament-types';
import { Owner, Player } from '@/lib/types';
import { computeMilestones } from '@/lib/match-analysis';

interface MatchChartsProps {
  innings: MatchInnings[];
  allBalls: MatchBall[][];
  team1: Owner;
  team2: Owner;
  team1Players?: Player[];
  team2Players?: Player[];
}

interface OverRow {
  over: number;
  runs: number;
  wickets: number;
}


const buildOvers = (balls: MatchBall[]): OverRow[] => {
  const map = new Map<number, OverRow>();
  balls.forEach((b) => {
    const row = map.get(b.over_number) || { over: b.over_number + 1, runs: 0, wickets: 0 };
    row.runs += b.runs_scored + b.extras;
    if (b.is_wicket) row.wickets += 1;
    map.set(b.over_number, row);
  });
  return Array.from(map.values()).sort((a, b) => a.over - b.over);
};

/** Manhattan (runs per over + wickets) and worm (cumulative runs) charts. */
export function MatchCharts({
  innings,
  allBalls,
  team1,
  team2,
  team1Players = [],
  team2Players = [],
}: MatchChartsProps) {
  const perInnings = useMemo(
    () =>
      innings.map((inn, idx) => {
        const battingIsTeam1 = inn.batting_team_id === team1.id;
        return {
          inn,
          name: battingIsTeam1 ? team1.team_name : team2.team_name,
          overs: buildOvers(allBalls[idx] || []),
          milestones: computeMilestones(
            allBalls[idx] || [],
            battingIsTeam1 ? team1Players : team2Players,
            battingIsTeam1 ? team2Players : team1Players,
          ).filter((m) => m.kind === 'team' || m.kind === 'partnership' || m.kind === 'wicket'),
        };
      }),
    [innings, allBalls, team1, team2, team1Players, team2Players],
  );

  const worm = useMemo(() => {
    const maxOvers = Math.max(0, ...perInnings.map((p) => p.overs.length));
    const rows: Record<string, number>[] = [];
    const running = perInnings.map(() => 0);
    for (let o = 0; o < maxOvers; o++) {
      const row: Record<string, number> = { over: o + 1 };
      perInnings.forEach((p, i) => {
        const entry = p.overs.find((x) => x.over === o + 1);
        if (entry || o < p.overs.length) running[i] += entry?.runs || 0;
        if (o < p.overs.length) row[`inn${i + 1}`] = running[i];
      });
      rows.push(row);
    }
    return rows;
  }, [perInnings]);

  const hasData = perInnings.some((p) => p.overs.length > 0);
  if (!hasData) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Charts appear once balls are recorded</p>;
  }

  const colors = ['hsl(var(--primary))', 'hsl(var(--destructive))', '#0ea5e9', '#f59e0b'];

  return (
    <div className="space-y-5">
      {perInnings.map((p, idx) =>
        p.overs.length ? (
          <div key={p.inn.id} className="rounded-xl border border-border/40 bg-card p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Runs per over — {p.name} (innings {p.inn.innings_number})
            </p>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={p.overs} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="over" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value, name, item) => {
                      const w = (item?.payload as OverRow)?.wickets || 0;
                      return [`${value} runs${w ? ` · ${w} wkt${w > 1 ? 's' : ''}` : ''}`, 'Over'];
                    }}
                  />
                  <Bar dataKey="runs" radius={[4, 4, 0, 0]}>
                    {p.overs.map((row) => (
                      <Cell
                        key={row.over}
                        fill={row.wickets > 0 ? 'hsl(var(--destructive))' : colors[idx % colors.length]}
                      />
                    ))}
                  </Bar>
                  {p.milestones.map((m, mi) => (
                    <ReferenceLine
                      key={`${m.label}-${mi}`}
                      x={m.over}
                      stroke={m.kind === 'wicket' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                      strokeDasharray="4 3"
                      strokeOpacity={0.7}
                    >
                      <Label
                        value={m.label}
                        position="top"
                        fontSize={9}
                        fill="hsl(var(--muted-foreground))"
                      />
                    </ReferenceLine>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">Red bars = over with wicket(s)</p>
          </div>
        ) : null,
      )}

      {perInnings.length > 1 && (
        <div className="rounded-xl border border-border/40 bg-card p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Worm — cumulative runs
          </p>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={worm} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="over" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {perInnings.map((p, i) => (
                  <Line
                    key={p.inn.id}
                    type="monotone"
                    dataKey={`inn${i + 1}`}
                    name={p.name}
                    stroke={colors[i % colors.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
