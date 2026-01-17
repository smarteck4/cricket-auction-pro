import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlayerMatchStats } from '@/lib/tournament-types';
import { Player } from '@/lib/types';
import { Trophy, Target, Flame, Zap, Award, Hand } from 'lucide-react';

interface StatisticsPanelProps {
  stats: PlayerMatchStats[];
  players: Player[];
}

interface AggregatedStats {
  player_id: string;
  player_name: string;
  total_runs: number;
  highest_score: number;
  balls_faced: number;
  fours: number;
  sixes: number;
  wickets: number;
  best_bowling: string;
  overs_bowled: number;
  runs_conceded: number;
  catches: number;
  run_outs: number;
  matches: number;
  hundreds: number;
  fifties: number;
  five_wickets: number;
}

export function StatisticsPanel({ stats, players }: StatisticsPanelProps) {
  const playerMap = new Map(players.map((p) => [p.id, p]));

  // Aggregate stats by player
  const aggregated: Map<string, AggregatedStats> = new Map();

  stats.forEach((stat) => {
    const player = playerMap.get(stat.player_id);
    if (!player) return;

    const existing = aggregated.get(stat.player_id);
    if (existing) {
      existing.total_runs += stat.runs_scored;
      existing.highest_score = Math.max(existing.highest_score, stat.runs_scored);
      existing.balls_faced += stat.balls_faced;
      existing.fours += stat.fours;
      existing.sixes += stat.sixes;
      existing.wickets += stat.wickets_taken;
      existing.overs_bowled += stat.overs_bowled;
      existing.runs_conceded += stat.runs_conceded;
      existing.catches += stat.catches;
      existing.run_outs += stat.run_outs;
      existing.matches += 1;
      if (stat.runs_scored >= 100) existing.hundreds += 1;
      if (stat.runs_scored >= 50 && stat.runs_scored < 100) existing.fifties += 1;
      if (stat.wickets_taken >= 5) existing.five_wickets += 1;
    } else {
      aggregated.set(stat.player_id, {
        player_id: stat.player_id,
        player_name: player.name,
        total_runs: stat.runs_scored,
        highest_score: stat.runs_scored,
        balls_faced: stat.balls_faced,
        fours: stat.fours,
        sixes: stat.sixes,
        wickets: stat.wickets_taken,
        best_bowling: `${stat.wickets_taken}/${stat.runs_conceded}`,
        overs_bowled: stat.overs_bowled,
        runs_conceded: stat.runs_conceded,
        catches: stat.catches,
        run_outs: stat.run_outs,
        matches: 1,
        hundreds: stat.runs_scored >= 100 ? 1 : 0,
        fifties: stat.runs_scored >= 50 && stat.runs_scored < 100 ? 1 : 0,
        five_wickets: stat.wickets_taken >= 5 ? 1 : 0,
      });
    }
  });

  const allStats = Array.from(aggregated.values());

  const getAverage = (runs: number, outs: number) => (outs > 0 ? (runs / outs).toFixed(2) : '-');
  const getStrikeRate = (runs: number, balls: number) => (balls > 0 ? ((runs / balls) * 100).toFixed(2) : '-');
  const getEconomy = (runs: number, overs: number) => (overs > 0 ? (runs / overs).toFixed(2) : '-');

  const topRunScorers = [...allStats].sort((a, b) => b.total_runs - a.total_runs).slice(0, 10);
  const topWicketTakers = [...allStats].sort((a, b) => b.wickets - a.wickets).slice(0, 10);
  const topCatchers = [...allStats].sort((a, b) => b.catches - a.catches).slice(0, 10);

  const StatCard = ({ icon: Icon, title, value, subtitle }: { icon: any; title: string; value: string | number; subtitle?: string }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const topScorer = topRunScorers[0];
  const topWicketTaker = topWicketTakers[0];

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Trophy}
          title="Top Run Scorer"
          value={topScorer?.total_runs || 0}
          subtitle={topScorer?.player_name || 'N/A'}
        />
        <StatCard
          icon={Target}
          title="Top Wicket Taker"
          value={topWicketTaker?.wickets || 0}
          subtitle={topWicketTaker?.player_name || 'N/A'}
        />
        <StatCard
          icon={Flame}
          title="Most Sixes"
          value={[...allStats].sort((a, b) => b.sixes - a.sixes)[0]?.sixes || 0}
          subtitle={[...allStats].sort((a, b) => b.sixes - a.sixes)[0]?.player_name || 'N/A'}
        />
        <StatCard
          icon={Hand}
          title="Most Catches"
          value={topCatchers[0]?.catches || 0}
          subtitle={topCatchers[0]?.player_name || 'N/A'}
        />
      </div>

      <Tabs defaultValue="batting">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="batting">Batting</TabsTrigger>
          <TabsTrigger value="bowling">Bowling</TabsTrigger>
          <TabsTrigger value="fielding">Fielding</TabsTrigger>
        </TabsList>

        <TabsContent value="batting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" /> Most Runs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-center">M</TableHead>
                    <TableHead className="text-center">Runs</TableHead>
                    <TableHead className="text-center">HS</TableHead>
                    <TableHead className="text-center">Avg</TableHead>
                    <TableHead className="text-center">SR</TableHead>
                    <TableHead className="text-center">100s</TableHead>
                    <TableHead className="text-center">50s</TableHead>
                    <TableHead className="text-center">4s</TableHead>
                    <TableHead className="text-center">6s</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topRunScorers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        No batting statistics yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    topRunScorers.map((stat, i) => (
                      <TableRow key={stat.player_id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{stat.player_name}</TableCell>
                        <TableCell className="text-center">{stat.matches}</TableCell>
                        <TableCell className="text-center font-bold">{stat.total_runs}</TableCell>
                        <TableCell className="text-center">{stat.highest_score}</TableCell>
                        <TableCell className="text-center">{getAverage(stat.total_runs, stat.matches)}</TableCell>
                        <TableCell className="text-center">{getStrikeRate(stat.total_runs, stat.balls_faced)}</TableCell>
                        <TableCell className="text-center text-green-600">{stat.hundreds}</TableCell>
                        <TableCell className="text-center text-blue-600">{stat.fifties}</TableCell>
                        <TableCell className="text-center">{stat.fours}</TableCell>
                        <TableCell className="text-center">{stat.sixes}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bowling" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" /> Top Wicket Takers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-center">M</TableHead>
                    <TableHead className="text-center">Wkts</TableHead>
                    <TableHead className="text-center">Overs</TableHead>
                    <TableHead className="text-center">Runs</TableHead>
                    <TableHead className="text-center">Econ</TableHead>
                    <TableHead className="text-center">5W</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topWicketTakers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No bowling statistics yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    topWicketTakers.map((stat, i) => (
                      <TableRow key={stat.player_id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{stat.player_name}</TableCell>
                        <TableCell className="text-center">{stat.matches}</TableCell>
                        <TableCell className="text-center font-bold">{stat.wickets}</TableCell>
                        <TableCell className="text-center">{stat.overs_bowled.toFixed(1)}</TableCell>
                        <TableCell className="text-center">{stat.runs_conceded}</TableCell>
                        <TableCell className="text-center">{getEconomy(stat.runs_conceded, stat.overs_bowled)}</TableCell>
                        <TableCell className="text-center text-purple-600">{stat.five_wickets}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fielding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hand className="h-5 w-5" /> Fielding Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-center">M</TableHead>
                    <TableHead className="text-center">Catches</TableHead>
                    <TableHead className="text-center">Run Outs</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCatchers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No fielding statistics yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    topCatchers.map((stat, i) => (
                      <TableRow key={stat.player_id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{stat.player_name}</TableCell>
                        <TableCell className="text-center">{stat.matches}</TableCell>
                        <TableCell className="text-center font-bold">{stat.catches}</TableCell>
                        <TableCell className="text-center">{stat.run_outs}</TableCell>
                        <TableCell className="text-center font-bold text-primary">
                          {stat.catches + stat.run_outs}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
