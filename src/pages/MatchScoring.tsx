import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Match } from '@/lib/tournament-types';
import { Owner, Player } from '@/lib/types';
import { LiveScoring } from '@/components/tournament/LiveScoring';
import { ArrowLeft } from 'lucide-react';

export default function MatchScoring() {
  const { matchId } = useParams<{ matchId: string }>();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [match, setMatch] = useState<Match | null>(null);
  const [team1, setTeam1] = useState<Owner | null>(null);
  const [team2, setTeam2] = useState<Owner | null>(null);
  const [team1Players, setTeam1Players] = useState<Player[]>([]);
  const [team2Players, setTeam2Players] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || role !== 'admin') {
      navigate('/');
      return;
    }
    if (matchId) {
      fetchMatchData();
    }
  }, [user, role, matchId]);

  const fetchMatchData = async () => {
    if (!matchId) return;

    // Fetch match
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('*, venue:venues(*)')
      .eq('id', matchId)
      .single();

    if (matchError || !matchData) {
      toast({ title: 'Error', description: 'Match not found', variant: 'destructive' });
      navigate('/tournaments');
      return;
    }

    setMatch(matchData as Match);

    // Fetch teams
    const [team1Res, team2Res] = await Promise.all([
      supabase.from('owners').select('*').eq('id', matchData.team1_id).single(),
      supabase.from('owners').select('*').eq('id', matchData.team2_id).single(),
    ]);

    if (team1Res.data) setTeam1(team1Res.data as Owner);
    if (team2Res.data) setTeam2(team2Res.data as Owner);

    // Fetch team players
    const { data: teamPlayersData } = await supabase
      .from('team_players')
      .select('owner_id, player_id')
      .in('owner_id', [matchData.team1_id, matchData.team2_id]);

    if (teamPlayersData) {
      const playerIds = teamPlayersData.map(tp => tp.player_id);
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .in('id', playerIds);

      if (playersData) {
        const team1PlayerIds = teamPlayersData
          .filter(tp => tp.owner_id === matchData.team1_id)
          .map(tp => tp.player_id);
        const team2PlayerIds = teamPlayersData
          .filter(tp => tp.owner_id === matchData.team2_id)
          .map(tp => tp.player_id);

        setTeam1Players(playersData.filter(p => team1PlayerIds.includes(p.id)) as Player[]);
        setTeam2Players(playersData.filter(p => team2PlayerIds.includes(p.id)) as Player[]);
      }
    }

    setLoading(false);
  };

  const handleBack = () => {
    navigate('/tournaments');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!match || !team1 || !team2) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Match not found</p>
            <Button onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tournaments
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="mb-4">
          <Button variant="ghost" onClick={handleBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Tournaments
          </Button>
        </div>
        
        <div className="max-w-4xl mx-auto">
          <LiveScoring
            match={match}
            team1={team1}
            team2={team2}
            team1Players={team1Players}
            team2Players={team2Players}
            onClose={handleBack}
            onMatchUpdate={fetchMatchData}
          />
        </div>
      </main>
    </div>
  );
}
