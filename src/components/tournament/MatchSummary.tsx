import { useMemo, useRef, useState } from 'react';
import { Match, MatchInnings, MatchBall } from '@/lib/tournament-types';
import { Player, Owner } from '@/lib/types';
import { Trophy, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';

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

  const renderTeamSection = (
    stats: NonNullable<typeof inn1Stats>,
    bgClass: string
  ) => {
    const { innings: inn, topBatsmen, topBowlers } = stats;
    const oversDisplay = `${Math.floor(inn.total_overs)}.${Math.round((inn.total_overs % 1) * 10)}`;

    return (
      <div className="mb-4">
        <div className={`${bgClass} px-4 py-3 flex justify-between items-center`}>
          <span className="font-semibold text-primary-foreground">{getTeamName(inn.batting_team_id)}</span>
          <div className="flex items-center gap-4 text-primary-foreground">
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

  // ===== PDF Export with full scorecard =====
  const exportMatchPDF = async () => {
    setExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const contentW = pageW - margin * 2;
      let y = margin;

      const checkPage = (needed: number) => {
        if (y + needed > pageH - margin) {
          pdf.addPage();
          y = margin;
        }
      };

      const drawLine = (yPos: number) => {
        pdf.setDrawColor(180, 180, 180);
        pdf.setLineWidth(0.3);
        pdf.line(margin, yPos, pageW - margin, yPos);
      };

      // ── Title Header ──
      pdf.setFillColor(30, 58, 95);
      pdf.rect(0, 0, pageW, 28, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('MATCH SCORECARD', pageW / 2, 11, { align: 'center' });
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${team1.team_name}  vs  ${team2.team_name}`, pageW / 2, 18, { align: 'center' });
      pdf.setFontSize(8);
      pdf.text(`${match.format} • ${match.overs_per_innings} overs per side`, pageW / 2, 24, { align: 'center' });
      y = 34;

      // ── Match Result ──
      if (matchResult) {
        pdf.setFillColor(245, 245, 220);
        pdf.rect(margin, y - 2, contentW, 10, 'F');
        pdf.setTextColor(30, 58, 95);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`🏆  ${matchResult}`, pageW / 2, y + 5, { align: 'center' });
        y += 14;
      }

      // ── Render each innings ──
      for (let innIdx = 0; innIdx < innings.length; innIdx++) {
        const analysis = getFullInningsAnalysis(innIdx);
        if (!analysis) continue;

        const { inn, batTeamName, fullBatsmen, fullBowlers, fow, overGroups, balls } = analysis;
        const oversDisplay = `${Math.floor(inn.total_overs)}.${Math.round((inn.total_overs % 1) * 10)}`;

        // Innings header
        checkPage(12);
        pdf.setFillColor(30, 58, 95);
        pdf.rect(margin, y, contentW, 9, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${batTeamName} — Innings ${inn.innings_number}`, margin + 4, y + 6);
        pdf.text(`${inn.total_runs}/${inn.total_wickets} (${oversDisplay} ov)`, pageW - margin - 4, y + 6, { align: 'right' });
        y += 13;

        // ── BATTING TABLE ──
        checkPage(10);
        pdf.setFillColor(235, 235, 235);
        pdf.rect(margin, y, contentW, 7, 'F');
        pdf.setTextColor(80, 80, 80);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');

        const batColX = [margin + 3, margin + 50, margin + 105, margin + 118, margin + 130, margin + 142, margin + 155];
        const batHeaders = ['Batsman', 'How Out', 'R', 'B', '4s', '6s', 'SR'];
        batHeaders.forEach((h, i) => {
          pdf.text(h, batColX[i], y + 5);
        });
        y += 9;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        fullBatsmen.forEach((bat, idx) => {
          checkPage(7);
          if (idx % 2 === 0) {
            pdf.setFillColor(248, 248, 248);
            pdf.rect(margin, y - 1, contentW, 6.5, 'F');
          }
          pdf.setTextColor(30, 30, 30);
          pdf.setFont('helvetica', 'bold');
          pdf.text(bat.name.substring(0, 22), batColX[0], y + 3.5);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 100, 100);
          pdf.text(bat.howOut.substring(0, 24), batColX[1], y + 3.5);
          pdf.setTextColor(30, 30, 30);
          pdf.setFont('helvetica', 'bold');
          pdf.text(bat.runs.toString(), batColX[2], y + 3.5);
          pdf.setFont('helvetica', 'normal');
          pdf.text(bat.balls.toString(), batColX[3], y + 3.5);
          pdf.text(bat.fours.toString(), batColX[4], y + 3.5);
          pdf.text(bat.sixes.toString(), batColX[5], y + 3.5);
          pdf.text(bat.sr.toFixed(1), batColX[6], y + 3.5);
          y += 6.5;
        });

        // Extras & Total row
        checkPage(14);
        drawLine(y);
        y += 2;
        pdf.setTextColor(80, 80, 80);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Extras: ${inn.extras}`, margin + 3, y + 4);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text(`Total: ${inn.total_runs}/${inn.total_wickets} (${oversDisplay} ov)`, pageW - margin - 4, y + 4, { align: 'right' });
        y += 8;

        // ── FALL OF WICKETS ──
        if (fow.length > 0) {
          checkPage(12);
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(80, 80, 80);
          pdf.text('Fall of Wickets:', margin + 3, y + 3);
          y += 5;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(6.5);
          const fowText = fow.map(f => `${f.wicketNum}-${f.score} (${f.batsmanName}, ${f.overs})`).join('  •  ');
          const fowLines = pdf.splitTextToSize(fowText, contentW - 6);
          fowLines.forEach((line: string) => {
            checkPage(5);
            pdf.text(line, margin + 3, y + 3);
            y += 4;
          });
          y += 2;
        }

        // ── BOWLING TABLE ──
        checkPage(12);
        drawLine(y);
        y += 3;
        pdf.setFillColor(235, 235, 235);
        pdf.rect(margin, y, contentW, 7, 'F');
        pdf.setTextColor(80, 80, 80);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');

        const bowlColX = [margin + 3, margin + 55, margin + 78, margin + 98, margin + 118, margin + 138, margin + 158];
        const bowlHeaders = ['Bowler', 'O', 'M', 'R', 'W', 'Eco'];
        bowlHeaders.forEach((h, i) => {
          pdf.text(h, bowlColX[i], y + 5);
        });
        y += 9;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        fullBowlers.forEach((bow, idx) => {
          checkPage(7);
          if (idx % 2 === 0) {
            pdf.setFillColor(248, 248, 248);
            pdf.rect(margin, y - 1, contentW, 6.5, 'F');
          }
          pdf.setTextColor(30, 30, 30);
          pdf.setFont('helvetica', 'bold');
          pdf.text(bow.name.substring(0, 25), bowlColX[0], y + 3.5);
          pdf.setFont('helvetica', 'normal');
          pdf.text(bow.overs, bowlColX[1], y + 3.5);
          pdf.text(bow.maidens.toString(), bowlColX[2], y + 3.5);
          pdf.text(bow.runs.toString(), bowlColX[3], y + 3.5);
          pdf.setFont('helvetica', 'bold');
          pdf.text(bow.wickets.toString(), bowlColX[4], y + 3.5);
          pdf.setFont('helvetica', 'normal');
          pdf.text(bow.economy, bowlColX[5], y + 3.5);
          y += 6.5;
        });
        y += 4;

        // ── BALL-BY-BALL ──
        checkPage(10);
        drawLine(y);
        y += 3;
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 58, 95);
        pdf.text('Ball-by-Ball Commentary', margin + 3, y + 4);
        y += 8;

        const sortedOvers = Array.from(overGroups.entries()).sort((a, b) => a[0] - b[0]);
        sortedOvers.forEach(([overNum, overBalls]) => {
          checkPage(10);
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(30, 58, 95);
          const bowlerName = overBalls[0]?.bowler_id ? getAllPlayerName(overBalls[0].bowler_id) : 'Unknown';
          pdf.text(`Over ${overNum + 1} (${bowlerName})`, margin + 3, y + 3);

          // Ball notations
          const notations = overBalls.map(b => getBallNotation(b));
          const overRuns = overBalls.reduce((s, b) => s + b.runs_scored + b.extras, 0);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(60, 60, 60);
          const ballsText = notations.join('  ');
          pdf.text(ballsText, margin + 60, y + 3);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(30, 30, 30);
          pdf.text(`= ${overRuns}`, pageW - margin - 4, y + 3, { align: 'right' });
          y += 5.5;
        });

        y += 6;
      }

      // ── Footer ──
      checkPage(10);
      drawLine(y);
      y += 4;
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Generated by CricBid • ${new Date().toLocaleDateString()}`, pageW / 2, y + 3, { align: 'center' });

      const t1 = team1.team_name.replace(/\s+/g, '_');
      const t2 = team2.team_name.replace(/\s+/g, '_');
      pdf.save(`Scorecard_${t1}_vs_${t2}.pdf`);
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

      <Button onClick={exportMatchPDF} disabled={exporting} variant="outline" className="w-full gap-2">
        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {exporting ? 'Generating PDF...' : 'Download Full Scorecard PDF'}
      </Button>
    </div>
  );
}
