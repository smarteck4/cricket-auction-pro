import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Tournament, Match, Venue, TournamentPoints, PlayerMatchStats } from '@/lib/tournament-types';
import { Owner, Player } from '@/lib/types';
import { TournamentForm } from '@/components/tournament/TournamentForm';
import { MatchForm } from '@/components/tournament/MatchForm';
import { VenueForm } from '@/components/tournament/VenueForm';
import { PointsTable } from '@/components/tournament/PointsTable';
import { StatisticsPanel } from '@/components/tournament/StatisticsPanel';
import { MatchCard } from '@/components/tournament/MatchCard';
import {
  FeaturedMatchTile,
  TournamentMetaTile,
  StandingsTile,
  FixturesTile,
  LeadersTile,
  TournamentSummaryStrip,
} from '@/components/tournament/BroadcastTiles';
import { TournamentHubSkeleton } from '@/components/tournament/BroadcastSkeleton';
import { Plus, Trophy, Calendar, MapPin, BarChart3, Edit, Trash2 } from 'lucide-react';

export default function Tournaments() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [teams, setTeams] = useState<Owner[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [points, setPoints] = useState<TournamentPoints[]>([]);
  const [stats, setStats] = useState<PlayerMatchStats[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState('fixtures');
  const [tournamentDialogOpen, setTournamentDialogOpen] = useState(false);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [venueDialogOpen, setVenueDialogOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  // Admins/super admins organize tournaments; owners & spectators get read-only access.
  const canManage = role === 'admin' || role === 'super_admin';

  useEffect(() => {
    if (authLoading) return;
    fetchData();
    const cleanupRealtime = setupRealtime();
    const cleanupPolling = setupPollingFallback();
    return () => {
      cleanupRealtime();
      cleanupPolling();
    };
  }, [user, role, authLoading]);

  const setupRealtime = () => {
    let lastRealtimeEvent = Date.now();
    const channel = supabase
      .channel('tournament-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => { lastRealtimeEvent = Date.now(); fetchData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_innings' }, () => { lastRealtimeEvent = Date.now(); fetchData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_match_stats' }, () => { lastRealtimeEvent = Date.now(); fetchData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_points' }, () => { lastRealtimeEvent = Date.now(); fetchData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_balls' }, () => { lastRealtimeEvent = Date.now(); fetchData(); })
      .subscribe();
    // Expose lastRealtimeEvent for polling fallback
    (window as any).__lastRealtimeEvent = () => lastRealtimeEvent;
    return () => { supabase.removeChannel(channel); };
  };

  const setupPollingFallback = () => {
    let pollInterval = 5000;
    let isActive = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = () => {
      if (!isActive) return;
      const lastEvent = (window as any).__lastRealtimeEvent?.() || 0;
      const timeSinceLastEvent = Date.now() - lastEvent;

      // If no realtime event in last 10s, poll as fallback
      if (timeSinceLastEvent > 10000) {
        fetchData();
        // Back off polling interval up to 30s
        pollInterval = Math.min(pollInterval * 1.5, 30000);
      } else {
        // Realtime is working, reset interval
        pollInterval = 5000;
      }

      timeoutId = setTimeout(poll, pollInterval);
    };

    timeoutId = setTimeout(poll, pollInterval);
    return () => { isActive = false; clearTimeout(timeoutId); };
  };

  const fetchData = async () => {
    const [tournamentsRes, matchesRes, venuesRes, teamsRes, playersRes, pointsRes, statsRes] = await Promise.all([
      supabase.from('tournaments').select('*').order('start_date', { ascending: false }),
      supabase.from('matches').select('*, venue:venues(*)').order('match_date'),
      supabase.from('venues').select('*'),
      supabase.from('owners').select('*'),
      supabase.from('players').select('*'),
      supabase.from('tournament_points').select('*, team:owners(id, team_name, team_logo_url)'),
      supabase.from('player_match_stats').select('*'),
    ]);

    if (tournamentsRes.data) setTournaments(tournamentsRes.data as Tournament[]);
    if (matchesRes.data) setMatches(matchesRes.data as Match[]);
    if (venuesRes.data) setVenues(venuesRes.data as Venue[]);
    if (teamsRes.data) setTeams(teamsRes.data as Owner[]);
    if (playersRes.data) setPlayers(playersRes.data as Player[]);
    if (pointsRes.data) setPoints(pointsRes.data as TournamentPoints[]);
    if (statsRes.data) setStats(statsRes.data as PlayerMatchStats[]);
    setLoading(false);
  };

  // Auto-select the first tournament so the hub is never empty.
  useEffect(() => {
    if (!selectedId && tournaments.length > 0) setSelectedId(tournaments[0].id);
    if (selectedId && !tournaments.some((t) => t.id === selectedId)) {
      setSelectedId(tournaments[0]?.id ?? null);
    }
  }, [tournaments, selectedId]);

  const selectedTournament = useMemo(
    () => tournaments.find((t) => t.id === selectedId) ?? null,
    [tournaments, selectedId],
  );

  const saveTournament = async (data: Partial<Tournament>) => {
    const dbData = { ...data } as any;
    if (editingTournament) {
      const { error } = await supabase.from('tournaments').update(dbData).eq('id', editingTournament.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Tournament Updated' });
    } else {
      const { error } = await supabase.from('tournaments').insert([dbData]);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Tournament Created' });
    }
    setTournamentDialogOpen(false);
    setEditingTournament(null);
    fetchData();
  };

  const deleteTournament = async (id: string) => {
    const { error } = await supabase.from('tournaments').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Tournament Deleted' });
    if (selectedId === id) setSelectedId(null);
    fetchData();
  };

  const saveMatch = async (data: Partial<Match>) => {
    const dbData = { ...data } as any;
    if (editingMatch) {
      const { error } = await supabase.from('matches').update(dbData).eq('id', editingMatch.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Match Updated' });
    } else {
      const { error } = await supabase.from('matches').insert([dbData]);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Match Scheduled' });
    }
    setMatchDialogOpen(false);
    setEditingMatch(null);
    fetchData();
  };

  const saveVenue = async (data: Partial<Venue>) => {
    const { error } = await supabase.from('venues').insert([data as any]);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Venue Added' });
    setVenueDialogOpen(false);
    fetchData();
  };

  const tournamentMatches = selectedTournament ? matches.filter((m) => m.tournament_id === selectedTournament.id) : [];
  const tournamentPoints = selectedTournament ? points.filter((p) => p.tournament_id === selectedTournament.id) : [];
  const tournamentMatchIds = new Set(tournamentMatches.map((m) => m.id));
  const tournamentStats = stats.filter((s) => tournamentMatchIds.has(s.match_id));

  const featuredMatch =
    tournamentMatches.find((m) => m.status === 'live') ??
    tournamentMatches.find((m) => m.status === 'scheduled') ??
    tournamentMatches[0];

  const openScoring = (m: Match) => {
    if (canManage) navigate(`/tournaments/match/${m.id}/scoring`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="bc-shell min-h-screen">
          <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-10">
            <TournamentHubSkeleton />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="bc-shell min-h-screen">
        <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-10 flex flex-col gap-4 sm:gap-6">
          {/* Broadcast header */}
          <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <h1 className="bc-heading text-2xl sm:text-3xl uppercase text-broadcast-accent">Tournaments</h1>
              {tournaments.length > 0 && (
                <Select value={selectedId ?? undefined} onValueChange={setSelectedId}>
                  <SelectTrigger className="w-full sm:w-64 bg-broadcast-surface/70 border-broadcast-fg/10 text-broadcast-fg">
                    <SelectValue placeholder="Select tournament" />
                  </SelectTrigger>
                  <SelectContent>
                    {tournaments.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {canManage && (
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                <Button
                  size="sm"
                  className="w-full sm:w-auto bg-broadcast-accent text-broadcast hover:bg-broadcast-accent/90 font-bold uppercase text-[11px] sm:text-xs tracking-widest"
                  onClick={() => { setEditingTournament(null); setTournamentDialogOpen(true); }}
                >
                  <Plus className="h-4 w-4 mr-1" />New
                  <span className="hidden sm:inline">&nbsp;Tournament</span>
                </Button>
                <Button
                  size="sm"
                  className="w-full sm:w-auto bg-broadcast-fg/10 text-broadcast-fg hover:bg-broadcast-fg/20 font-bold uppercase text-[11px] sm:text-xs tracking-widest"
                  onClick={() => setVenueDialogOpen(true)}
                >
                  <MapPin className="h-4 w-4 mr-1" />Add Venue
                </Button>
                {selectedTournament && (
                  <>
                    <Button
                      size="icon"
                      className="bg-broadcast-fg/10 text-broadcast-fg hover:bg-broadcast-fg/20"
                      aria-label="Edit tournament"
                      onClick={() => { setEditingTournament(selectedTournament); setTournamentDialogOpen(true); }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      className="bg-broadcast-fg/10 text-destructive hover:bg-destructive/20"
                      aria-label="Delete tournament"
                      onClick={() => deleteTournament(selectedTournament.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            )}
          </header>

          {!selectedTournament ? (
            <div className="bc-tile p-10 text-center">
              <Trophy className="h-10 w-10 mx-auto mb-4 text-broadcast-accent/60" />
              <p className="bc-heading text-lg text-broadcast-fg uppercase">No tournaments yet</p>
              <p className="text-sm text-broadcast-muted mt-1">
                {canManage ? 'Naya tournament create karein' : 'Abhi koi tournament organize nahi hua'}
              </p>
            </div>
          ) : (
            <>
              {/* Bento grid hub */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4">
                <FeaturedMatchTile
                  match={featuredMatch}
                  teams={teams}
                  onOpen={canManage && featuredMatch ? () => openScoring(featuredMatch) : undefined}
                />
                <TournamentMetaTile tournament={selectedTournament} />
                <StandingsTile points={tournamentPoints} onViewFull={() => setDetailTab('points')} />
                <FixturesTile
                  matches={tournamentMatches}
                  teams={teams}
                  onSelect={canManage ? openScoring : undefined}
                />
                <LeadersTile stats={tournamentStats} players={players} />
                <TournamentSummaryStrip
                  matchCount={tournamentMatches.length}
                  teamCount={tournamentPoints.length}
                  completed={tournamentMatches.filter((m) => m.status === 'completed').length}
                />
              </div>

              {/* Full detail panels keep the app theme for dense tables */}
              <section className="rounded-2xl bg-background text-foreground p-3 sm:p-6 border border-broadcast-fg/5">
                <Tabs value={detailTab} onValueChange={setDetailTab}>
                  <TabsList className="mb-4 grid w-full grid-cols-3 h-auto gap-1 sm:flex sm:w-auto">
                    <TabsTrigger value="fixtures" className="text-xs sm:text-sm px-2"><Calendar className="h-4 w-4 sm:mr-2" /><span className="hidden xs:inline sm:inline">Fixtures</span></TabsTrigger>
                    <TabsTrigger value="points" className="text-xs sm:text-sm px-2"><Trophy className="h-4 w-4 sm:mr-2" /><span className="hidden xs:inline sm:inline">Points</span></TabsTrigger>
                    <TabsTrigger value="stats" className="text-xs sm:text-sm px-2"><BarChart3 className="h-4 w-4 sm:mr-2" /><span className="hidden xs:inline sm:inline">Stats</span></TabsTrigger>
                  </TabsList>

                  <TabsContent value="fixtures">
                    {canManage && (
                      <div className="flex justify-end mb-4">
                        <Button className="w-full sm:w-auto" onClick={() => { setEditingMatch(null); setMatchDialogOpen(true); }}>
                          <Plus className="h-4 w-4 mr-2" />Schedule Match
                        </Button>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      {tournamentMatches.map((m) => (
                        <MatchCard
                          key={m.id}
                          match={m}
                          team1={teams.find((t) => t.id === m.team1_id)}
                          team2={teams.find((t) => t.id === m.team2_id)}
                          onClick={canManage ? () => openScoring(m) : undefined}
                        />
                      ))}
                      {tournamentMatches.length === 0 && (
                        <p className="text-muted-foreground col-span-full text-center py-8">No matches scheduled yet</p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="points"><PointsTable points={tournamentPoints} /></TabsContent>
                  <TabsContent value="stats"><StatisticsPanel stats={tournamentStats} players={players} /></TabsContent>
                </Tabs>
              </section>
            </>
          )}
        </div>
      </main>

      {/* Dialogs */}
      <Dialog open={tournamentDialogOpen} onOpenChange={setTournamentDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>{editingTournament ? 'Edit' : 'Create'} Tournament</DialogTitle></DialogHeader>
          <TournamentForm tournament={editingTournament} onSubmit={saveTournament} onCancel={() => setTournamentDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>{editingMatch ? 'Edit' : 'Schedule'} Match</DialogTitle></DialogHeader>
          <MatchForm match={editingMatch} tournaments={tournaments} teams={teams} venues={venues} onSubmit={saveMatch} onCancel={() => setMatchDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={venueDialogOpen} onOpenChange={setVenueDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Add Venue</DialogTitle></DialogHeader>
          <VenueForm onSubmit={saveVenue} onCancel={() => setVenueDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
