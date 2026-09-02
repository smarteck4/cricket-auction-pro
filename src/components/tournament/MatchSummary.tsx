import { useMemo, useRef, useState } from 'react';
import { Match, MatchInnings, MatchBall } from '@/lib/tournament-types';
import { Player, Owner } from '@/lib/types';
import { Trophy, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateMatchPdf } from '@/lib/match-pdf';
import { PlayerAvatar, TeamLogo } from './ScoreAvatars';

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

// Full scorecard types for PDF
interface FullBatsmanStats {
  id: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  sr: number;
  isOut: boolean;
  howOut: string;
}

interface FullBowlerStats {
  id: string;
  name: string;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  economy: string;
  legalBalls: number;
}

interface FOW {
  wicketNum: number;
  score: number;
  batsmanName: string;
  overs: string;
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
  const summaryRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const getPlayerName = (id: string | null, players: Player[]) => {
    if (!id) return 'Unknown';
    const player = players.find(p => p.id === id);
    return player?.name || 'Unknown';
  };

  const getAllPlayerName = (id: string | null) => {
    if (!id) return 'Unknown';
    const player = [...team1Players, ...team2Players].find(p => p.id === id);
    return player?.name || 'Unknown';
  };

  // Calculate top batsmen and bowlers for each innings (for UI display)
  const getInningsStats = (inningsIndex: number, battingPlayers: Player[], bowlingPlayers: Player[]) => {
    const balls = allBalls[inningsIndex] || [];
    const inn = innings[inningsIndex];

    const batsmenMap = new Map<string, { runs: number; balls: number; isOut: boolean }>();
    const bowlersMap = new Map<string, { wickets: number; runs: number; legalBalls: number }>();

    balls.forEach(ball => {
      if (ball.batsman_id) {
        const existing = batsmenMap.get(ball.batsman_id) || { runs: 0, balls: 0, isOut: false };
        const isBallFaced = ball.extra_type !== 'wide';
        const isBatsmanRun = !ball.extra_type || ball.extra_type === 'no_ball';
        existing.runs += isBatsmanRun ? ball.runs_scored : 0;
        existing.balls += isBallFaced ? 1 : 0;
        if (ball.is_wicket) existing.isOut = true;
        batsmenMap.set(ball.batsman_id, existing);
      }

      if (ball.bowler_id) {
        const existing = bowlersMap.get(ball.bowler_id) || { wickets: 0, runs: 0, legalBalls: 0 };
        const isLegal = !ball.extra_type || !['wide', 'no_ball'].includes(ball.extra_type);
        const isBowlerCharged = !ball.extra_type || ball.extra_type === 'wide' || ball.extra_type === 'no_ball';
        existing.runs += isBowlerCharged ? (ball.runs_scored + ball.extras) : 0;
        if (isLegal) existing.legalBalls++;
        if (ball.is_wicket && ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket'].includes(ball.wicket_type || '')) {
          existing.wickets++;
        }
        bowlersMap.set(ball.bowler_id, existing);
      }
    });

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

  // Full innings analysis for PDF export
  const getFullInningsAnalysis = (inningsIndex: number) => {
    const balls = allBalls[inningsIndex] || [];
    const inn = innings[inningsIndex];
    if (!inn || balls.length === 0) return null;

    const isBattingTeam1 = inn.batting_team_id === team1.id;
    const batPlayers = isBattingTeam1 ? team1Players : team2Players;
    const bowlPlayers = isBattingTeam1 ? team2Players : team1Players;
    const batTeamName = isBattingTeam1 ? team1.team_name : team2.team_name;
    const bowlTeamName = isBattingTeam1 ? team2.team_name : team1.team_name;

    const batStats = new Map<string, { runs: number; balls: number; fours: number; sixes: number; isOut: boolean; howOut: string }>();
    const bowlStats = new Map<string, { legalBalls: number; runs: number; wickets: number }>();
    const bowlOverRuns = new Map<string, Map<number, number>>();
    const bowlOverBalls = new Map<string, Map<number, number>>();
    const fow: FOW[] = [];
    const batsmanOrder: string[] = [];
    const bowlerOrder: string[] = [];
    let totalRuns = 0;
    let totalWickets = 0;
    let legalBallCount = 0;

    balls.forEach(ball => {
      const isLegal = !ball.extra_type || !['wide', 'no_ball'].includes(ball.extra_type);
      const isBatsmanRun = !ball.extra_type || ball.extra_type === 'no_ball';
      const isBallFaced = ball.extra_type !== 'wide';

      totalRuns += ball.runs_scored + ball.extras;
      if (isLegal) legalBallCount++;

      if (ball.batsman_id) {
        if (!batsmanOrder.includes(ball.batsman_id)) batsmanOrder.push(ball.batsman_id);
        const existing = batStats.get(ball.batsman_id) || { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, howOut: 'not out' };
        const bRuns = isBatsmanRun ? ball.runs_scored : 0;
        existing.runs += bRuns;
        existing.balls += isBallFaced ? 1 : 0;
        if (bRuns === 4) existing.fours++;
        if (bRuns === 6) existing.sixes++;

        if (ball.is_wicket) {
          existing.isOut = true;
          const bowlerName = bowlPlayers.find(p => p.id === ball.bowler_id)?.name?.split(' ').pop() || '';
          const fielderName = bowlPlayers.find(p => p.id === ball.fielder_id)?.name?.split(' ').pop() || '';
          switch (ball.wicket_type) {
            case 'bowled': existing.howOut = `b ${bowlerName}`; break;
            case 'caught':
              existing.howOut = ball.fielder_id === ball.bowler_id
                ? `c & b ${bowlerName}`
                : `c ${fielderName} b ${bowlerName}`;
              break;
            case 'lbw': existing.howOut = `lbw b ${bowlerName}`; break;
            case 'stumped': existing.howOut = `st ${fielderName} b ${bowlerName}`; break;
            case 'run_out': existing.howOut = fielderName ? `run out (${fielderName})` : 'run out'; break;
            case 'hit_wicket': existing.howOut = `hit wkt b ${bowlerName}`; break;
            default: existing.howOut = ball.wicket_type || 'out';
          }
          totalWickets++;
          const ov = `${Math.floor(legalBallCount / 6)}.${legalBallCount % 6}`;
          fow.push({
            wicketNum: totalWickets,
            score: totalRuns,
            batsmanName: batPlayers.find(p => p.id === ball.batsman_id)?.name?.split(' ').pop() || '',
            overs: ov,
          });
        }
        batStats.set(ball.batsman_id, existing);
      }

      if (ball.bowler_id) {
        if (!bowlerOrder.includes(ball.bowler_id)) bowlerOrder.push(ball.bowler_id);
        const existing = bowlStats.get(ball.bowler_id) || { legalBalls: 0, runs: 0, wickets: 0 };
        const isBowlerCharged = !ball.extra_type || ball.extra_type === 'wide' || ball.extra_type === 'no_ball';
        const rc = isBowlerCharged ? (ball.runs_scored + ball.extras) : 0;
        existing.runs += rc;
        if (isLegal) existing.legalBalls++;
        if (ball.is_wicket && ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket'].includes(ball.wicket_type || '')) {
          existing.wickets++;
        }
        bowlStats.set(ball.bowler_id, existing);

        if (!bowlOverRuns.has(ball.bowler_id)) bowlOverRuns.set(ball.bowler_id, new Map());
        bowlOverRuns.get(ball.bowler_id)!.set(ball.over_number, (bowlOverRuns.get(ball.bowler_id)!.get(ball.over_number) || 0) + rc);
        if (!bowlOverBalls.has(ball.bowler_id)) bowlOverBalls.set(ball.bowler_id, new Map());
        if (isLegal) {
          bowlOverBalls.get(ball.bowler_id)!.set(ball.over_number, (bowlOverBalls.get(ball.bowler_id)!.get(ball.over_number) || 0) + 1);
        }
      }
    });

    // Calculate maidens
    bowlOverRuns.forEach((overMap, bowlerId) => {
      const stats = bowlStats.get(bowlerId);
      const ballsMap = bowlOverBalls.get(bowlerId);
      if (stats && ballsMap) {
        let mc = 0;
        overMap.forEach((runs, overNum) => {
          if (runs === 0 && (ballsMap.get(overNum) || 0) >= 6) mc++;
        });
        (stats as any).maidens = mc;
      }
    });

    const fullBatsmen: FullBatsmanStats[] = batsmanOrder.map(id => {
      const stats = batStats.get(id)!;
      const player = batPlayers.find(p => p.id === id);
      return {
        id,
        name: player?.name || 'Unknown',
        runs: stats.runs,
        balls: stats.balls,
        fours: stats.fours,
        sixes: stats.sixes,
        sr: stats.balls > 0 ? (stats.runs / stats.balls) * 100 : 0,
        isOut: stats.isOut,
        howOut: stats.howOut,
      };
    });

    const fullBowlers: FullBowlerStats[] = bowlerOrder.map(id => {
      const stats = bowlStats.get(id)!;
      const player = bowlPlayers.find(p => p.id === id);
      const completedOvers = Math.floor(stats.legalBalls / 6);
      const remainBalls = stats.legalBalls % 6;
      return {
        id,
        name: player?.name || 'Unknown',
        overs: `${completedOvers}.${remainBalls}`,
        maidens: (stats as any).maidens || 0,
        runs: stats.runs,
        wickets: stats.wickets,
        economy: stats.legalBalls > 0 ? (stats.runs / (stats.legalBalls / 6)).toFixed(2) : '0.00',
        legalBalls: stats.legalBalls,
      };
    });

    // Ball-by-ball data grouped by over
    const overGroups = new Map<number, MatchBall[]>();
    balls.forEach(ball => {
      const oNum = ball.over_number;
      if (!overGroups.has(oNum)) overGroups.set(oNum, []);
      overGroups.get(oNum)!.push(ball);
    });

    return {
      inn,
      batTeamName,
      bowlTeamName,
      fullBatsmen,
      fullBowlers,
      fow,
      overGroups,
      balls,
    };
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

  const getBallNotation = (ball: MatchBall) => {
    if (ball.is_wicket) {
      const total = ball.runs_scored + ball.extras;
      if (ball.extra_type === 'wide') return total > 0 ? `W+${total}Wd` : 'W';
      if (ball.extra_type === 'no_ball') return total > 0 ? `W+${total}Nb` : 'W';
      return total > 0 ? `W+${total}` : 'W';
    }
    if (ball.extra_type === 'wide') return ball.extras > 1 ? `${ball.extras}Wd` : 'Wd';
    if (ball.extra_type === 'no_ball') return ball.runs_scored > 0 ? `${ball.runs_scored}+${ball.extras}Nb` : `${ball.extras}Nb`;
    if (ball.extra_type === 'bye') return `${ball.extras}B`;
    if (ball.extra_type === 'leg_bye') return `${ball.extras}Lb`;
    return ball.runs_scored.toString();
  };

  const findPlayer = (id?: string | null) =>
    id ? [...team1Players, ...team2Players].find((p) => p.id === id) ?? null : null;

  const renderTeamSection = (
    stats: NonNullable<typeof inn1Stats>,
    bgClass: string
  ) => {
    const { innings: inn, topBatsmen, topBowlers } = stats;
    const oversDisplay = `${Math.floor(inn.total_overs)}.${Math.round((inn.total_overs % 1) * 10)}`;
    const battingTeam = inn.batting_team_id === team1.id ? team1 : team2;

    return (
      <div className="mb-4">
        <div className={`${bgClass} px-4 py-3 flex justify-between items-center gap-3`}>
          <span className="font-semibold text-primary-foreground inline-flex items-center gap-2 min-w-0">
            <TeamLogo team={battingTeam} size={28} />
            <span className="truncate">{getTeamName(inn.batting_team_id)}</span>
          </span>
          <div className="flex items-center gap-4 text-primary-foreground shrink-0">
            <span className="font-bold">{inn.total_runs}-{inn.total_wickets}</span>
            <span className="text-sm opacity-80">{oversDisplay} Overs</span>
          </div>
        </div>

        <div className="bg-card border-x border-b">
          {Array.from({ length: Math.max(topBatsmen.length, topBowlers.length, 4) }).map((_, i) => {
            const batsman = topBatsmen[i];
            const bowler = topBowlers[i];

            return (
              <div
                key={i}
                className={`grid grid-cols-2 divide-x ${i % 2 === 0 ? 'bg-card' : 'bg-muted/30'}`}
              >
                <div className="flex justify-between items-center gap-2 px-3 sm:px-4 py-2">
                  {batsman ? (
                    <>
                      <span className="text-sm inline-flex items-center gap-2 min-w-0">
                        <PlayerAvatar player={findPlayer(batsman.id)} size={24} />
                        <span className="truncate">
                          <span className="font-medium">{batsman.name.split(' ')[0]}</span>
                          {batsman.name.split(' ').slice(1).length > 0 && (
                            <span className="font-bold"> {batsman.name.split(' ').slice(1).join(' ')}</span>
                          )}
                        </span>
                      </span>
                      <span className="font-bold text-sm shrink-0">
                        {batsman.runs}
                        {batsman.isNotOut && <span className="text-muted-foreground"> *</span>}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </div>

                <div className="flex justify-between items-center gap-2 px-3 sm:px-4 py-2">
                  {bowler ? (
                    <>
                      <span className="text-sm inline-flex items-center gap-2 min-w-0">
                        <PlayerAvatar player={findPlayer(bowler.id)} size={24} />
                        <span className="truncate">
                          <span className="font-medium">{bowler.name.split(' ')[0]}</span>
                          {bowler.name.split(' ').slice(1).length > 0 && (
                            <span className="font-bold"> {bowler.name.split(' ').slice(1).join(' ')}</span>
                          )}
                        </span>
                      </span>
                      <span className="font-bold text-sm shrink-0">
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

  // ===== PDF Export with full scorecard =====
  const exportMatchPDF = async () => {
    setExporting(true);
    try {
      generateMatchPdf({ match, team1, team2, team1Players, team2Players, innings, allBalls });
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div ref={summaryRef} className="rounded-lg overflow-hidden border bg-gradient-to-b from-slate-900 to-slate-800">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-primary-foreground tracking-tight">MATCH SUMMARY</h2>
            {match.status === 'live' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                Live · auto-updating
              </span>
            )}
          </div>
          <p className="text-sm text-primary-foreground/70">
            {match.format} • {match.overs_per_innings} overs • {allBalls.flat().length} balls recorded
          </p>
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

      <Button onClick={exportMatchPDF} disabled={exporting} variant="outline" className="w-full gap-2">
        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {exporting
          ? 'Generating PDF...'
          : match.status === 'live'
            ? 'Download Live Scorecard PDF (current state)'
            : 'Download Full Scorecard PDF'}
      </Button>
    </div>
  );
}
