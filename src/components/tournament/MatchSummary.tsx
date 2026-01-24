import { useMemo } from 'react';
import { Match, MatchInnings, MatchBall } from '@/lib/tournament-types';
import { Player, Owner } from '@/lib/types';
import { Trophy } from 'lucide-react';

interface MatchSummaryProps {
  match: Match;
  team1: Owner;
  team2: Owner;
  team1Players: Player[];
  team2Players: Player[];
  innings: MatchInnings[];
  allBalls: MatchBall[][];
}

interface BatsmanSummary {
  id: string;
  name: string;
  runs: number;
  balls: number;
  isNotOut: boolean;
}

interface BowlerSummary {
  id: string;
  name: string;
  wickets: number;
  runs: number;
  overs: number;
}

export function MatchSummary({
  match,
  team1,
  team2,
  team1Players,
  team2Players,
  innings,
  allBalls,
}: MatchSummaryProps) {
  const getPlayerName = (id: string | null, players: Player[]) => {
    if (!id) return 'Unknown';
    const player = players.find(p => p.id === id);
    return player?.name || 'Unknown';
  };

  // Calculate top batsmen and bowlers for each innings
  const getInningsStats = (inningsIndex: number, battingPlayers: Player[], bowlingPlayers: Player[]) => {
    const balls = allBalls[inningsIndex] || [];
    const inn = innings[inningsIndex];
    
    // Batsmen stats
    const batsmenMap = new Map<string, { runs: number; balls: number; isOut: boolean }>();
    const bowlersMap = new Map<string, { wickets: number; runs: number; legalBalls: number }>();
    
    balls.forEach(ball => {
      // Batsman stats
      if (ball.batsman_id) {
        const existing = batsmenMap.get(ball.batsman_id) || { runs: 0, balls: 0, isOut: false };
        const isBallFaced = ball.extra_type !== 'wide';
        existing.runs += ball.runs_scored;
        existing.balls += isBallFaced ? 1 : 0;
        if (ball.is_wicket && ball.batsman_id === ball.batsman_id) {
          existing.isOut = true;
        }
        batsmenMap.set(ball.batsman_id, existing);
      }
      
      // Check for wicket on this ball
      if (ball.is_wicket && ball.batsman_id) {
        const existing = batsmenMap.get(ball.batsman_id);
        if (existing) {
          existing.isOut = true;
          batsmenMap.set(ball.batsman_id, existing);
        }
      }
      
      // Bowler stats
      if (ball.bowler_id) {
        const existing = bowlersMap.get(ball.bowler_id) || { wickets: 0, runs: 0, legalBalls: 0 };
        const isLegal = !ball.extra_type || !['wide', 'no_ball'].includes(ball.extra_type);
        
        existing.runs += ball.runs_scored + ball.extras;
        if (isLegal) existing.legalBalls++;
        
        if (ball.is_wicket && ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket'].includes(ball.wicket_type || '')) {
          existing.wickets++;
        }
        
        bowlersMap.set(ball.bowler_id, existing);
      }
    });
    
    // Convert to arrays and sort
    const topBatsmen: BatsmanSummary[] = Array.from(batsmenMap.entries())
      .map(([id, stats]) => ({
        id,
        name: getPlayerName(id, battingPlayers),
        runs: stats.runs,
        balls: stats.balls,
        isNotOut: !stats.isOut,
      }))
      .sort((a, b) => b.runs - a.runs)
      .slice(0, 4);
    
    const topBowlers: BowlerSummary[] = Array.from(bowlersMap.entries())
      .map(([id, stats]) => ({
        id,
        name: getPlayerName(id, bowlingPlayers),
        wickets: stats.wickets,
        runs: stats.runs,
        overs: stats.legalBalls / 6,
      }))
      .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)
      .slice(0, 4);
    
    return { topBatsmen, topBowlers, innings: inn };
  };

  const inn1Stats = useMemo(() => {
    if (innings.length < 1) return null;
    const inn = innings[0];
    const battingPlayers = inn.batting_team_id === team1.id ? team1Players : team2Players;
    const bowlingPlayers = inn.bowling_team_id === team1.id ? team1Players : team2Players;
    return getInningsStats(0, battingPlayers, bowlingPlayers);
  }, [innings, allBalls, team1, team2, team1Players, team2Players]);

  const inn2Stats = useMemo(() => {
    if (innings.length < 2) return null;
    const inn = innings[1];
    const battingPlayers = inn.batting_team_id === team1.id ? team1Players : team2Players;
    const bowlingPlayers = inn.bowling_team_id === team1.id ? team1Players : team2Players;
    return getInningsStats(1, battingPlayers, bowlingPlayers);
  }, [innings, allBalls, team1, team2, team1Players, team2Players]);

  const getMatchResult = () => {
    if (match.status !== 'completed' || innings.length < 2) return null;
    
    const inn1 = innings[0];
    const inn2 = innings[1];
    
    const team1Batting = inn1.batting_team_id === team1.id ? inn1 : inn2;
    const team2Batting = inn1.batting_team_id === team2.id ? inn1 : inn2;
    
    if (team1Batting.total_runs > team2Batting.total_runs) {
      const margin = team1Batting.total_runs - team2Batting.total_runs;
      return `${team1.team_name} win by ${margin} runs`;
    } else if (team2Batting.total_runs > team1Batting.total_runs) {
      const wicketsRemaining = 10 - team2Batting.total_wickets;
      if (inn2.batting_team_id === team2.id) {
        return `${team2.team_name} win by ${wicketsRemaining} wickets`;
      } else {
        const margin = team2Batting.total_runs - team1Batting.total_runs;
        return `${team2.team_name} win by ${margin} runs`;
      }
    }
    return 'Match Tied';
  };

  const getTeamName = (teamId: string) => {
    return teamId === team1.id ? team1.team_name : team2.team_name;
  };

  const renderTeamSection = (
    stats: NonNullable<typeof inn1Stats>,
    bgClass: string
  ) => {
    const { innings: inn, topBatsmen, topBowlers } = stats;
    const oversDisplay = `${Math.floor(inn.total_overs)}.${Math.round((inn.total_overs % 1) * 10)}`;
    
    return (
      <div className="mb-4">
        {/* Team Header */}
        <div className={`${bgClass} px-4 py-3 flex justify-between items-center`}>
          <span className="font-semibold text-primary-foreground">{getTeamName(inn.batting_team_id)}</span>
          <div className="flex items-center gap-4 text-primary-foreground">
            <span className="font-bold">{inn.total_runs}-{inn.total_wickets}</span>
            <span className="text-sm opacity-80">{oversDisplay} Overs</span>
          </div>
        </div>
        
        {/* Player Stats */}
        <div className="bg-card border-x border-b">
          {Array.from({ length: Math.max(topBatsmen.length, topBowlers.length, 4) }).map((_, i) => {
            const batsman = topBatsmen[i];
            const bowler = topBowlers[i];
            
            return (
              <div
                key={i}
                className={`grid grid-cols-2 divide-x ${i % 2 === 0 ? 'bg-card' : 'bg-muted/30'}`}
              >
                {/* Batsman */}
                <div className="flex justify-between items-center px-4 py-2">
                  {batsman ? (
                    <>
                      <span className="text-sm">
                        <span className="font-medium">{batsman.name.split(' ')[0]}</span>
                        {batsman.name.split(' ').slice(1).length > 0 && (
                          <span className="font-bold"> {batsman.name.split(' ').slice(1).join(' ')}</span>
                        )}
                      </span>
                      <span className="font-bold text-sm">
                        {batsman.runs}
                        {batsman.isNotOut && <span className="text-muted-foreground"> *</span>}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </div>
                
                {/* Bowler */}
                <div className="flex justify-between items-center px-4 py-2">
                  {bowler ? (
                    <>
                      <span className="text-sm">
                        <span className="font-medium">{bowler.name.split(' ')[0]}</span>
                        {bowler.name.split(' ').slice(1).length > 0 && (
                          <span className="font-bold"> {bowler.name.split(' ').slice(1).join(' ')}</span>
                        )}
                      </span>
                      <span className="font-bold text-sm">
                        {bowler.wickets}-{bowler.runs}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (innings.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>No match data available yet</p>
      </div>
    );
  }

  const matchResult = getMatchResult();

  return (
    <div className="rounded-lg overflow-hidden border bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 px-4 py-4">
        <h2 className="text-xl font-bold text-primary-foreground tracking-tight">MATCH SUMMARY</h2>
        <p className="text-sm text-primary-foreground/70">{match.format} • {match.overs_per_innings} overs</p>
      </div>
      
      {/* Teams */}
      <div className="p-4 space-y-2">
        {inn1Stats && renderTeamSection(inn1Stats, 'bg-primary')}
        {inn2Stats && renderTeamSection(inn2Stats, 'bg-secondary')}
      </div>
      
      {/* Result */}
      {matchResult && (
        <div className="px-4 py-3 bg-muted/50 border-t flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{matchResult}</span>
        </div>
      )}
    </div>
  );
}
