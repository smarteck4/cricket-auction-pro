import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PointsTable } from '@/components/tournament/PointsTable';
import { StatisticsPanel } from '@/components/tournament/StatisticsPanel';
import { MatchDownloadButton } from '@/components/tournament/MatchDownloadButton';
import { BroadcastSkeleton } from '@/components/tournament/BroadcastSkeleton';
import {
  Match,
  MatchBall,
  MatchInnings,
  PlayerMatchStats,
  Tournament,
  TournamentPoints,
} from '@/lib/tournament-types';
import { Owner, Player } from '@/lib/types';
import { deriveStatsFromBalls, mergeMatchStats } from '@/lib/derive-match-stats';
import { getMatchResultText } from '@/lib/match-pdf';
import { Trophy, CalendarDays, MapPin } from 'lucide-react';

/** Season-wise results hub: completed matches, leaderboard and aggregated stats. */
export default function Results() {
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [seasonId, setSeasonId] = useState<string>('all');
  const [matches, setMatches] = useState<Match[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [points, setPoints] = useState<TournamentPoints[]>([]);
  const [innings, setInnings] = useState<MatchInnings[]>([]);
  const [balls, setBalls] = useState<MatchBall[]>([]);
  const [storedStats, setStoredStats] = useState<PlayerMatchStats[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [tRes, mRes, oRes, pRes, ptRes, iRes, sRes] = await Promise.all([
        supabase.from('tournaments').select('*').order('start_date', { ascending: false }),
        supabase.from('matches').select('*, venue:venues(*)').eq('status', 'completed').order('match_date', { ascending: false }),
        supabase.from('owners').select('*'),
        supabase.from('players').select('*'),
        supabase.from('tournament_points').select('*'),
        supabase.from('match_innings').select('*').order('innings_number'),
        supabase.from('player_match_stats').select('*'),
      ]);

      setTournaments((tRes.data as Tournament[]) || []);
      setMatches((mRes.data as unknown as Match[]) || []);
      setOwners((oRes.data as Owner[]) || []);
      setPlayers((pRes.data as Player[]) || []);
      setPoints((ptRes.data as TournamentPoints[]) || []);
      const inn = (iRes.data as MatchInnings[]) || [];
      setInnings(inn);
      setStoredStats((sRes.data as PlayerMatchStats[]) || []);

      if (inn.length > 0) {
        const { data: ballData } = await supabase
          .from('match_balls')
          .select('*')
          .in('innings_id', inn.map((i) => i.id))
          .order('created_at');
        setBalls((ballData as MatchBall[]) || []);
      }
      setLoading(false);
    };
    load();
  }, []);

  const ownerById = useMemo(() => new Map(owners.map((o) => [o.id, o])), [owners]);

  const seasonMatches = useMemo(
    () => (seasonId === 'all' ? matches : matches.filter((m) => m.tournament_id === seasonId)),
    [matches, seasonId],
  );

  const seasonPoints = useMemo(
    () =>
      (seasonId === 'all' ? points : points.filter((p) => p.tournament_id === seasonId)).map((p) => ({
        ...p,
        team: p.team ?? (ownerById.get(p.team_id)
          ? {
              id: p.team_id,
              team_name: ownerById.get(p.team_id)!.team_name,
              team_logo_url: ownerById.get(p.team_id)!.team_logo_url ?? null,
            }
          : undefined),
      })),
    [points, seasonId, ownerById],
  );

  const seasonStats = useMemo(() => {
    const matchIds = new Set(seasonMatches.map((m) => m.id));
    const seasonInnings = innings.filter((i) => matchIds.has(i.match_id));
    const inningsIds = new Set(seasonInnings.map((i) => i.id));
    const seasonBalls = balls.filter((b) => inningsIds.has(b.innings_id));
    const derived = deriveStatsFromBalls(seasonInnings, seasonBalls);
    return mergeMatchStats(storedStats.filter((s) => matchIds.has(s.match_id)), derived);
  }, [seasonMatches, innings, balls, storedStats]);

  const totals = useMemo(() => {
    const matchIds = new Set(seasonMatches.map((m) => m.id));
    const seasonInnings = innings.filter((i) => matchIds.has(i.match_id));
    return {
      matches: seasonMatches.length,
      runs: seasonInnings.reduce((s, i) => s + i.total_runs, 0),
      wickets: seasonInnings.reduce((s, i) => s + i.total_wickets, 0),
      teams: new Set(seasonMatches.flatMap((m) => [m.team1_id, m.team2_id].filter(Boolean))).size,
    };
  }, [seasonMatches, innings]);

  const inningsFor = (matchId: string) => innings.filter((i) => i.match_id === matchId);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 sm:py-10">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-4xl">Results & Season Leaderboard</h1>
            <p className="text-sm text-muted-foreground">
              Every completed match, season standings and aggregated player statistics.
            </p>
          </div>
          <Select value={seasonId} onValueChange={setSeasonId}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Select season" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All seasons</SelectItem>
              {tournaments.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <BroadcastSkeleton />
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Matches', value: totals.matches },
                { label: 'Teams', value: totals.teams },
                { label: 'Runs scored', value: totals.runs },
                { label: 'Wickets', value: totals.wickets },
              ].map((s) => (
                <Card key={s.label} className="card-shadow">
                  <CardContent className="p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                    <p className="font-display text-2xl font-bold tabular-nums">{s.value.toLocaleString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Tabs defaultValue="results">
              <TabsList className="mb-4 bg-transparent gap-2">
                <TabsTrigger value="results">Results</TabsTrigger>
                <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
                <TabsTrigger value="stats">Statistics</TabsTrigger>
              </TabsList>

              <TabsContent value="results" className="space-y-3">
                {seasonMatches.length === 0 ? (
                  <p className="py-10 text-center text-muted-foreground">No completed matches yet.</p>
                ) : (
                  seasonMatches.map((m) => {
                    const t1 = ownerById.get(m.team1_id || '');
                    const t2 = ownerById.get(m.team2_id || '');
                    const mi = inningsFor(m.id);
                    return (
                      <Card key={m.id} className="card-shadow">
                        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">{m.format}</Badge>
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <CalendarDays className="h-3 w-3" />
                                {new Date(m.match_date).toLocaleDateString()}
                              </span>
                              {m.venue?.name && (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  {m.venue.name}
                                </span>
                              )}
                            </div>
                            <p className="truncate font-semibold">
                              {t1?.team_name || 'TBD'} vs {t2?.team_name || 'TBD'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {mi
                                .map((i) => `${i.total_runs}/${i.total_wickets} (${i.total_overs} ov)`)
                                .join('  •  ') || 'No scorecard data'}
                            </p>
                            {t1 && t2 && (
                              <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary">
                                <Trophy className="h-3.5 w-3.5" />
                                {getMatchResultText(m, t1, t2, mi)}
                              </p>
                            )}
                          </div>
                          <MatchDownloadButton match={m} team1={t1} team2={t2} />
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="leaderboard">
                <Card className="card-shadow">
                  <CardHeader>
                    <CardTitle className="text-base">Season standings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PointsTable points={seasonPoints} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="stats">
                <StatisticsPanel stats={seasonStats} players={players} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
