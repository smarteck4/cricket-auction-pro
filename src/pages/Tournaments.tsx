import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Tournament, Match, Venue, TournamentPoints, PlayerMatchStats, TOURNAMENT_STATUS_COLORS } from '@/lib/tournament-types';
import { Owner, Player } from '@/lib/types';
import { TournamentForm } from '@/components/tournament/TournamentForm';
import { MatchForm } from '@/components/tournament/MatchForm';
import { VenueForm } from '@/components/tournament/VenueForm';
import { PointsTable } from '@/components/tournament/PointsTable';
import { StatisticsPanel } from '@/components/tournament/StatisticsPanel';
import { LiveScoring } from '@/components/tournament/LiveScoring';
import { MatchCard } from '@/components/tournament/MatchCard';
import { Plus, Trophy, Calendar, MapPin, BarChart3, Edit, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function Tournaments() {
  const { user, role } = useAuth();
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

  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [tournamentDialogOpen, setTournamentDialogOpen] = useState(false);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [venueDialogOpen, setVenueDialogOpen] = useState(false);
  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  useEffect(() => {
    if (!user || role !== 'admin') {
      navigate('/');
      return;
    }
    fetchData();
    setupRealtime();
  }, [user, role]);

  const setupRealtime = () => {
    const channel = supabase
      .channel('tournament-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_innings' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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

  const saveTournament = async (data: Partial<Tournament>) => {
    if (editingTournament) {
      const { error } = await supabase.from('tournaments').update(data).eq('id', editingTournament.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Tournament Updated' });
    } else {
      const { error } = await supabase.from('tournaments').insert([data as any]);
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
    if (selectedTournament?.id === id) setSelectedTournament(null);
    fetchData();
  };

  const saveMatch = async (data: Partial<Match>) => {
    if (editingMatch) {
      const { error } = await supabase.from('matches').update(data).eq('id', editingMatch.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Match Updated' });
    } else {
      const { error } = await supabase.from('matches').insert([data as any]);
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

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Tournament Management</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setVenueDialogOpen(true)}><MapPin className="h-4 w-4 mr-2" />Add Venue</Button>
            <Button onClick={() => { setEditingTournament(null); setTournamentDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />New Tournament</Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Tournament List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="font-semibold text-lg">Tournaments</h2>
            {tournaments.map((t) => (
              <Card key={t.id} className={`cursor-pointer transition-all ${selectedTournament?.id === t.id ? 'ring-2 ring-primary' : ''}`} onClick={() => setSelectedTournament(t)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-sm text-muted-foreground">{t.format} • {t.overs_per_innings} overs</p>
                      <p className="text-xs text-muted-foreground mt-1">{format(new Date(t.start_date), 'PP')} - {format(new Date(t.end_date), 'PP')}</p>
                    </div>
                    <Badge className={`${TOURNAMENT_STATUS_COLORS[t.status].bg} ${TOURNAMENT_STATUS_COLORS[t.status].text}`}>{t.status}</Badge>
                  </div>
                  <div className="flex gap-1 mt-2">
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditingTournament(t); setTournamentDialogOpen(true); }}><Edit className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteTournament(t.id); }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tournament Details */}
          <div className="lg:col-span-3">
            {selectedTournament ? (
              <Tabs defaultValue="fixtures">
                <TabsList className="mb-4">
                  <TabsTrigger value="fixtures"><Calendar className="h-4 w-4 mr-2" />Fixtures</TabsTrigger>
                  <TabsTrigger value="points"><Trophy className="h-4 w-4 mr-2" />Points Table</TabsTrigger>
                  <TabsTrigger value="stats"><BarChart3 className="h-4 w-4 mr-2" />Statistics</TabsTrigger>
                </TabsList>

                <TabsContent value="fixtures">
                  <div className="flex justify-end mb-4">
                    <Button onClick={() => { setEditingMatch(null); setMatchDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />Schedule Match</Button>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tournamentMatches.map((m) => (
                      <MatchCard key={m.id} match={m} team1={teams.find((t) => t.id === m.team1_id)} team2={teams.find((t) => t.id === m.team2_id)} onClick={() => setScoringMatch(m)} />
                    ))}
                    {tournamentMatches.length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">No matches scheduled yet</p>}
                  </div>
                </TabsContent>

                <TabsContent value="points"><PointsTable points={tournamentPoints} /></TabsContent>
                <TabsContent value="stats"><StatisticsPanel stats={stats} players={players} /></TabsContent>
              </Tabs>
            ) : (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Select a tournament to view details</CardContent></Card>
            )}
          </div>
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

      <Dialog open={!!scoringMatch} onOpenChange={() => setScoringMatch(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Live Scoring</DialogTitle></DialogHeader>
          {scoringMatch && (
            <LiveScoring
              match={scoringMatch}
              team1={teams.find((t) => t.id === scoringMatch.team1_id)!}
              team2={teams.find((t) => t.id === scoringMatch.team2_id)!}
              team1Players={players.filter((p) => p.auction_status === 'sold')}
              team2Players={players.filter((p) => p.auction_status === 'sold')}
              onClose={() => setScoringMatch(null)}
              onMatchUpdate={fetchData}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
