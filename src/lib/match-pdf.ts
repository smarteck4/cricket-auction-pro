import jsPDF from 'jspdf';
import { Match, MatchInnings, MatchBall } from '@/lib/tournament-types';
import { Player, Owner } from '@/lib/types';

export interface MatchPdfData {
  match: Match;
  team1: Owner;
  team2: Owner;
  team1Players: Player[];
  team2Players: Player[];
  innings: MatchInnings[];
  allBalls: MatchBall[][];
}

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

export function getMatchResultText(data: MatchPdfData): string | null {
  const { match, team1, team2, innings } = data;
  if (match.status !== 'completed' || innings.length < 2) return null;
  const inn1 = innings[0];
  const inn2 = innings[1];
  const team1Batting = inn1.batting_team_id === team1.id ? inn1 : inn2;
  const team2Batting = inn1.batting_team_id === team2.id ? inn1 : inn2;

  if (team1Batting.total_runs > team2Batting.total_runs) {
    return `${team1.team_name} win by ${team1Batting.total_runs - team2Batting.total_runs} runs`;
  }
  if (team2Batting.total_runs > team1Batting.total_runs) {
    if (inn2.batting_team_id === team2.id) {
      return `${team2.team_name} win by ${10 - team2Batting.total_wickets} wickets`;
    }
    return `${team2.team_name} win by ${team2Batting.total_runs - team1Batting.total_runs} runs`;
  }
  return 'Match Tied';
}

function analyseInnings(data: MatchPdfData, inningsIndex: number) {
  const { team1, team2, team1Players, team2Players, innings, allBalls } = data;
  const balls = allBalls[inningsIndex] || [];
  const inn = innings[inningsIndex];
  if (!inn || balls.length === 0) return null;

  const isBattingTeam1 = inn.batting_team_id === team1.id;
  const batPlayers = isBattingTeam1 ? team1Players : team2Players;
  const bowlPlayers = isBattingTeam1 ? team2Players : team1Players;
  const batTeamName = isBattingTeam1 ? team1.team_name : team2.team_name;
  const bowlTeamName = isBattingTeam1 ? team2.team_name : team1.team_name;

  const batStats = new Map<string, { runs: number; balls: number; fours: number; sixes: number; isOut: boolean; howOut: string }>();
  const bowlStats = new Map<string, { legalBalls: number; runs: number; wickets: number; maidens?: number }>();
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
            existing.howOut = ball.fielder_id === ball.bowler_id ? `c & b ${bowlerName}` : `c ${fielderName} b ${bowlerName}`;
            break;
          case 'lbw': existing.howOut = `lbw b ${bowlerName}`; break;
          case 'stumped': existing.howOut = `st ${fielderName} b ${bowlerName}`; break;
          case 'run_out': existing.howOut = fielderName ? `run out (${fielderName})` : 'run out'; break;
          case 'hit_wicket': existing.howOut = `hit wkt b ${bowlerName}`; break;
          default: existing.howOut = ball.wicket_type || 'out';
        }
        totalWickets++;
        fow.push({
          wicketNum: totalWickets,
          score: totalRuns,
          batsmanName: batPlayers.find(p => p.id === ball.batsman_id)?.name?.split(' ').pop() || '',
          overs: `${Math.floor(legalBallCount / 6)}.${legalBallCount % 6}`,
        });
      }
      batStats.set(ball.batsman_id, existing);
    }

    if (ball.bowler_id) {
      if (!bowlerOrder.includes(ball.bowler_id)) bowlerOrder.push(ball.bowler_id);
      const existing = bowlStats.get(ball.bowler_id) || { legalBalls: 0, runs: 0, wickets: 0 };
      const isBowlerCharged = !ball.extra_type || ball.extra_type === 'wide' || ball.extra_type === 'no_ball';
      const rc = isBowlerCharged ? ball.runs_scored + ball.extras : 0;
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

  bowlOverRuns.forEach((overMap, bowlerId) => {
    const stats = bowlStats.get(bowlerId);
    const ballsMap = bowlOverBalls.get(bowlerId);
    if (stats && ballsMap) {
      let mc = 0;
      overMap.forEach((runs, overNum) => {
        if (runs === 0 && (ballsMap.get(overNum) || 0) >= 6) mc++;
      });
      stats.maidens = mc;
    }
  });

  const fullBatsmen: FullBatsmanStats[] = batsmanOrder.map(id => {
    const stats = batStats.get(id)!;
    return {
      id,
      name: batPlayers.find(p => p.id === id)?.name || 'Unknown',
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
    return {
      id,
      name: bowlPlayers.find(p => p.id === id)?.name || 'Unknown',
      overs: `${Math.floor(stats.legalBalls / 6)}.${stats.legalBalls % 6}`,
      maidens: stats.maidens || 0,
      runs: stats.runs,
      wickets: stats.wickets,
      economy: stats.legalBalls > 0 ? (stats.runs / (stats.legalBalls / 6)).toFixed(2) : '0.00',
      legalBalls: stats.legalBalls,
    };
  });

  const overGroups = new Map<number, MatchBall[]>();
  balls.forEach(ball => {
    if (!overGroups.has(ball.over_number)) overGroups.set(ball.over_number, []);
    overGroups.get(ball.over_number)!.push(ball);
  });

  return { inn, batTeamName, bowlTeamName, fullBatsmen, fullBowlers, fow, overGroups, balls };
}

export function generateMatchPdf(data: MatchPdfData) {
  const { match, team1, team2, team1Players, team2Players, innings } = data;
  const allPlayers = [...team1Players, ...team2Players];
  const playerName = (id?: string | null) => (id ? allPlayers.find(p => p.id === id)?.name || 'Unknown' : 'Unknown');
  const matchResult = getMatchResultText(data);

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

  if (match.venue) {
    pdf.setTextColor(90, 90, 90);
    pdf.setFontSize(8);
    pdf.text(`${match.venue.name}, ${match.venue.city}`, pageW / 2, y, { align: 'center' });
    y += 6;
  }

  if (matchResult) {
    pdf.setFillColor(245, 245, 220);
    pdf.rect(margin, y - 2, contentW, 10, 'F');
    pdf.setTextColor(30, 58, 95);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text(matchResult, pageW / 2, y + 5, { align: 'center' });
    y += 14;
  }

  for (let innIdx = 0; innIdx < innings.length; innIdx++) {
    const analysis = analyseInnings(data, innIdx);
    if (!analysis) continue;
    const { inn, batTeamName, fullBatsmen, fullBowlers, fow, overGroups } = analysis;
    const oversDisplay = `${Math.floor(inn.total_overs)}.${Math.round((inn.total_overs % 1) * 10)}`;

    checkPage(12);
    pdf.setFillColor(30, 58, 95);
    pdf.rect(margin, y, contentW, 9, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${batTeamName} — Innings ${inn.innings_number}`, margin + 4, y + 6);
    pdf.text(`${inn.total_runs}/${inn.total_wickets} (${oversDisplay} ov)`, pageW - margin - 4, y + 6, { align: 'right' });
    y += 13;

    checkPage(10);
    pdf.setFillColor(235, 235, 235);
    pdf.rect(margin, y, contentW, 7, 'F');
    pdf.setTextColor(80, 80, 80);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    const batColX = [margin + 3, margin + 50, margin + 105, margin + 118, margin + 130, margin + 142, margin + 155];
    ['Batsman', 'How Out', 'R', 'B', '4s', '6s', 'SR'].forEach((h, i) => pdf.text(h, batColX[i], y + 5));
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
      pdf.splitTextToSize(fowText, contentW - 6).forEach((line: string) => {
        checkPage(5);
        pdf.text(line, margin + 3, y + 3);
        y += 4;
      });
      y += 2;
    }

    checkPage(12);
    drawLine(y);
    y += 3;
    pdf.setFillColor(235, 235, 235);
    pdf.rect(margin, y, contentW, 7, 'F');
    pdf.setTextColor(80, 80, 80);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    const bowlColX = [margin + 3, margin + 55, margin + 78, margin + 98, margin + 118, margin + 138];
    ['Bowler', 'O', 'M', 'R', 'W', 'Eco'].forEach((h, i) => pdf.text(h, bowlColX[i], y + 5));
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

    checkPage(10);
    drawLine(y);
    y += 3;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 58, 95);
    pdf.text('Ball-by-Ball Commentary', margin + 3, y + 4);
    y += 8;

    Array.from(overGroups.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([overNum, overBalls]) => {
        checkPage(10);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 58, 95);
        pdf.text(`Over ${overNum + 1} (${playerName(overBalls[0]?.bowler_id)})`, margin + 3, y + 3);
        const overRuns = overBalls.reduce((s, b) => s + b.runs_scored + b.extras, 0);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(60, 60, 60);
        pdf.text(overBalls.map(getBallNotation).join('  '), margin + 60, y + 3);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text(`= ${overRuns}`, pageW - margin - 4, y + 3, { align: 'right' });
        y += 5.5;
      });

    y += 6;
  }

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
}
