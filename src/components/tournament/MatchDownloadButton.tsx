import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2 } from 'lucide-react';
import { Match, MatchBall, MatchInnings } from '@/lib/tournament-types';
import { Owner, Player } from '@/lib/types';
import { generateMatchPdf } from '@/lib/match-pdf';

interface MatchDownloadButtonProps {
  match: Match;
  team1?: Owner;
  team2?: Owner;
  className?: string;
}

export function MatchDownloadButton({ match, team1, team2, className = '' }: MatchDownloadButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const [inningsRes, venueRes] = await Promise.all([
        supabase.from('match_innings').select('*').eq('match_id', match.id).order('innings_number'),
        match.venue ? Promise.resolve({ data: match.venue }) : supabase.from('venues').select('*').eq('id', match.venue_id ?? '').maybeSingle(),
      ]);

      const innings = (inningsRes.data as MatchInnings[]) || [];
      if (innings.length === 0) {
        toast({ title: 'No scorecard data', description: 'This match has no recorded scoring data.', variant: 'destructive' });
        return;
      }

      const allBalls: MatchBall[][] = [];
      for (const inn of innings) {
        const { data } = await supabase.from('match_balls').select('*').eq('innings_id', inn.id).order('created_at');
        allBalls.push((data as MatchBall[]) || []);
      }

      // Resolve teams if not provided
      let t1 = team1;
      let t2 = team2;
      if (!t1 || !t2) {
        const { data: owners } = await supabase
          .from('owners')
          .select('*')
          .in('id', [match.team1_id, match.team2_id].filter(Boolean) as string[]);
        t1 = t1 || (owners?.find(o => o.id === match.team1_id) as Owner | undefined);
        t2 = t2 || (owners?.find(o => o.id === match.team2_id) as Owner | undefined);
      }
      if (!t1 || !t2) {
        toast({ title: 'Teams not found', description: 'Unable to load team details for this match.', variant: 'destructive' });
        return;
      }

      // Players: roster + anyone appearing in the ball log
      const { data: teamPlayersData } = await supabase
        .from('team_players')
        .select('owner_id, player_id')
        .in('owner_id', [t1.id, t2.id]);

      const inningsTeamMap = new Map(innings.map(i => [i.id, i.batting_team_id]));
      const ballPlayerIds: { playerId: string; teamId: string }[] = [];
      allBalls.flat().forEach(ball => {
        const battingTeamId = inningsTeamMap.get(ball.innings_id) || '';
        const bowlingTeamId = battingTeamId === t1!.id ? t2!.id : t1!.id;
        if (ball.batsman_id) ballPlayerIds.push({ playerId: ball.batsman_id, teamId: battingTeamId });
        if (ball.bowler_id) ballPlayerIds.push({ playerId: ball.bowler_id, teamId: bowlingTeamId });
        if (ball.fielder_id) ballPlayerIds.push({ playerId: ball.fielder_id, teamId: bowlingTeamId });
      });

      const roster1 = (teamPlayersData || []).filter(tp => tp.owner_id === t1!.id).map(tp => tp.player_id);
      const roster2 = (teamPlayersData || []).filter(tp => tp.owner_id === t2!.id).map(tp => tp.player_id);
      const team1Ids = [...new Set([...roster1, ...ballPlayerIds.filter(b => b.teamId === t1!.id).map(b => b.playerId)])];
      const team2Ids = [...new Set([...roster2, ...ballPlayerIds.filter(b => b.teamId === t2!.id).map(b => b.playerId)])];
      const allIds = [...new Set([...team1Ids, ...team2Ids])];

      let team1Players: Player[] = [];
      let team2Players: Player[] = [];
      if (allIds.length > 0) {
        const { data: playersData } = await supabase.from('players').select('*').in('id', allIds);
        team1Players = ((playersData as Player[]) || []).filter(p => team1Ids.includes(p.id));
        team2Players = ((playersData as Player[]) || []).filter(p => team2Ids.includes(p.id));
      }

      generateMatchPdf({
        match: { ...match, venue: match.venue ?? (venueRes as any)?.data ?? undefined },
        team1: t1,
        team2: t2,
        team1Players,
        team2Players,
        innings,
        allBalls,
      });

      toast({ title: 'Downloaded', description: 'Full match scorecard PDF saved.' });
    } catch (err) {
      console.error('Match PDF download failed:', err);
      toast({ title: 'Download failed', description: 'Could not generate the match PDF.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`h-8 w-8 shrink-0 ${className}`}
      onClick={handleDownload}
      disabled={loading}
      aria-label="Download full match scorecard as PDF"
      title="Download full scorecard (PDF)"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
    </Button>
  );
}
