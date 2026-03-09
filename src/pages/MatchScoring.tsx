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
    if (!user || (role !== 'admin' && role !== 'super_admin')) {
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

    // Also fetch all player IDs used in match_balls for this match
    const { data: matchInningsData } = await supabase
      .from('match_innings')
      .select('id, batting_team_id')
      .eq('match_id', matchId);

    let ballPlayerIds: { playerId: string; teamId: string }[] = [];
    if (matchInningsData && matchInningsData.length > 0) {
      const inningsIds = matchInningsData.map(i => i.id);
      const { data: ballsData } = await supabase
        .from('match_balls')
        .select('batsman_id, bowler_id, fielder_id, innings_id')
        .in('innings_id', inningsIds);

      if (ballsData) {
        const inningsTeamMap = new Map(matchInningsData.map(i => [i.id, i.batting_team_id]));
        ballsData.forEach(ball => {
          const battingTeamId = inningsTeamMap.get(ball.innings_id) || '';
          const bowlingTeamId = battingTeamId === matchData.team1_id ? matchData.team2_id : matchData.team1_id;
          if (ball.batsman_id) ballPlayerIds.push({ playerId: ball.batsman_id, teamId: battingTeamId });
          if (ball.bowler_id) ballPlayerIds.push({ playerId: ball.bowler_id, teamId: bowlingTeamId });
          if (ball.fielder_id) ballPlayerIds.push({ playerId: ball.fielder_id, teamId: bowlingTeamId });
        });
      }
    }

    // Combine all player IDs
    const teamPlayerIds = teamPlayersData?.map(tp => tp.player_id) || [];
    const extraPlayerIds = ballPlayerIds.map(bp => bp.playerId).filter(id => !teamPlayerIds.includes(id));
    const allPlayerIds = [...new Set([...teamPlayerIds, ...extraPlayerIds])];

    if (allPlayerIds.length > 0) {
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .in('id', allPlayerIds);

      if (playersData) {
        const team1PlayerIdsFromRoster = (teamPlayersData || [])
          .filter(tp => tp.owner_id === matchData.team1_id)
          .map(tp => tp.player_id);
        const team2PlayerIdsFromRoster = (teamPlayersData || [])
          .filter(tp => tp.owner_id === matchData.team2_id)
          .map(tp => tp.player_id);

        // Add players from match_balls that aren't in the roster
        const team1ExtraIds = ballPlayerIds
          .filter(bp => bp.teamId === matchData.team1_id && !team1PlayerIdsFromRoster.includes(bp.playerId))
          .map(bp => bp.playerId);
        const team2ExtraIds = ballPlayerIds
          .filter(bp => bp.teamId === matchData.team2_id && !team2PlayerIdsFromRoster.includes(bp.playerId))
          .map(bp => bp.playerId);

        const allTeam1Ids = [...new Set([...team1PlayerIdsFromRoster, ...team1ExtraIds])];
        const allTeam2Ids = [...new Set([...team2PlayerIdsFromRoster, ...team2ExtraIds])];

        setTeam1Players(playersData.filter(p => allTeam1Ids.includes(p.id)) as Player[]);
        setTeam2Players(playersData.filter(p => allTeam2Ids.includes(p.id)) as Player[]);
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
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <Header />
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="mb-4">
          <Button variant="ghost" onClick={handleBack} className="gap-2 text-muted-foreground hover:text-foreground transition-colors">
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
