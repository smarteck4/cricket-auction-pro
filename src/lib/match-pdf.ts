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
  dots: number;
  fours: number;
  sixes: number;
  wides: number;
  noBalls: number;
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
    if (ball.extra_type === 'wide') return total > 0 ? `W+${total}wd` : 'W';
    if (ball.extra_type === 'no_ball') return total > 0 ? `W+${total}nb` : 'W';
    return total > 0 ? `W+${total}` : 'W';
  }
  if (ball.extra_type === 'wide') return ball.extras > 1 ? `${ball.extras}wd` : 'wd';
  if (ball.extra_type === 'no_ball') return ball.runs_scored > 0 ? `${ball.runs_scored}+${ball.extras}nb` : `${ball.extras}nb`;
  if (ball.extra_type === 'bye') return `${ball.extras}b`;
  if (ball.extra_type === 'leg_bye') return `${ball.extras}lb`;
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
    return `${team1.team_name} won by ${team1Batting.total_runs - team2Batting.total_runs} runs`;
  }
  if (team2Batting.total_runs > team1Batting.total_runs) {
    if (inn2.batting_team_id === team2.id) {
      return `${team2.team_name} won by ${10 - team2Batting.total_wickets} wickets`;
    }
    return `${team2.team_name} won by ${team2Batting.total_runs - team1Batting.total_runs} runs`;
  }
  return 'Match tied';
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
  const bowlStats = new Map<
    string,
    { legalBalls: number; runs: number; wickets: number; maidens?: number; dots: number; fours: number; sixes: number; wides: number; noBalls: number }
  >();
  const bowlOverRuns = new Map<string, Map<number, number>>();
  const bowlOverBalls = new Map<string, Map<number, number>>();
  const fow: FOW[] = [];
  const batsmanOrder: string[] = [];
  const bowlerOrder: string[] = [];
  const extraBreakdown = { b: 0, lb: 0, w: 0, nb: 0 };
  let totalRuns = 0;
  let totalWickets = 0;
  let legalBallCount = 0;

  balls.forEach(ball => {
    const isLegal = !ball.extra_type || !['wide', 'no_ball'].includes(ball.extra_type);
    const isBatsmanRun = !ball.extra_type || ball.extra_type === 'no_ball';
    const isBallFaced = ball.extra_type !== 'wide';

    totalRuns += ball.runs_scored + ball.extras;
    if (isLegal) legalBallCount++;

    if (ball.extra_type === 'bye') extraBreakdown.b += ball.extras;
    else if (ball.extra_type === 'leg_bye') extraBreakdown.lb += ball.extras;
    else if (ball.extra_type === 'wide') extraBreakdown.w += ball.extras;
    else if (ball.extra_type === 'no_ball') extraBreakdown.nb += ball.extras;

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
          case 'hit_wicket': existing.howOut = `hit wicket b ${bowlerName}`; break;
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
      const existing =
        bowlStats.get(ball.bowler_id) || { legalBalls: 0, runs: 0, wickets: 0, dots: 0, fours: 0, sixes: 0, wides: 0, noBalls: 0 };
      const isBowlerCharged = !ball.extra_type || ball.extra_type === 'wide' || ball.extra_type === 'no_ball';
      const rc = isBowlerCharged ? ball.runs_scored + ball.extras : 0;
      existing.runs += rc;
      if (isLegal) existing.legalBalls++;
      if (isLegal && ball.runs_scored + ball.extras === 0) existing.dots++;
      if (isBatsmanRun && ball.runs_scored === 4) existing.fours++;
      if (isBatsmanRun && ball.runs_scored === 6) existing.sixes++;
      if (ball.extra_type === 'wide') existing.wides++;
      if (ball.extra_type === 'no_ball') existing.noBalls++;
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
      dots: stats.dots,
      fours: stats.fours,
      sixes: stats.sixes,
      wides: stats.wides,
      noBalls: stats.noBalls,
    };
  });

  const didNotBat = batPlayers.filter(p => !batsmanOrder.includes(p.id)).map(p => p.name);

  const overGroups = new Map<number, MatchBall[]>();
  balls.forEach(ball => {
    if (!overGroups.has(ball.over_number)) overGroups.set(ball.over_number, []);
    overGroups.get(ball.over_number)!.push(ball);
  });

  const totalExtras = extraBreakdown.b + extraBreakdown.lb + extraBreakdown.w + extraBreakdown.nb;
  const runRate = legalBallCount > 0 ? totalRuns / (legalBallCount / 6) : 0;

  return {
    inn,
    batTeamName,
    bowlTeamName,
    fullBatsmen,
    fullBowlers,
    fow,
    overGroups,
    balls,
    extraBreakdown,
    totalExtras,
    didNotBat,
    runRate,
    legalBallCount,
  };
}

/* ============================================================
   ESPNcricinfo-style scorecard PDF
   Clean white sheet, thin grey rules, muted table headers,
   crimson accent — same information hierarchy as cricinfo.
   ============================================================ */
export function generateMatchPdf(data: MatchPdfData) {
  const { match, team1, team2, team1Players, team2Players, innings } = data;
  const allPlayers = [...team1Players, ...team2Players];
  const playerName = (id?: string | null) => (id ? allPlayers.find(p => p.id === id)?.name || 'Unknown' : 'Unknown');
  const matchResult = getMatchResultText(data);

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = margin;

  const INK: [number, number, number] = [26, 26, 26];
  const MUTED: [number, number, number] = [110, 110, 110];
  const RULE: [number, number, number] = [222, 222, 222];
  const HEADROW: [number, number, number] = [244, 244, 244];
  const ACCENT: [number, number, number] = [175, 30, 45];

  const setInk = (c: [number, number, number]) => pdf.setTextColor(c[0], c[1], c[2]);

  const checkPage = (needed: number) => {
    if (y + needed > pageH - margin - 8) {
      pdf.addPage();
      y = margin;
    }
  };

  const rule = (yPos: number, color = RULE) => {
    pdf.setDrawColor(color[0], color[1], color[2]);
    pdf.setLineWidth(0.2);
    pdf.line(margin, yPos, pageW - margin, yPos);
  };

  const sectionTitle = (text: string) => {
    checkPage(12);
    setInk(INK);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text(text.toUpperCase(), margin, y + 3.5);
    pdf.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    pdf.setLineWidth(0.7);
    pdf.line(margin, y + 5.5, margin + pdf.getTextWidth(text.toUpperCase()), y + 5.5);
    y += 9;
  };

  // ---------- Masthead ----------
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  setInk(ACCENT);
  pdf.text('FULL SCORECARD', margin, y + 3);
  setInk(MUTED);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text(match.tournament?.name || 'Match', pageW - margin, y + 3, { align: 'right' });
  y += 6;
  rule(y);
  y += 7;

  setInk(INK);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text(`${team1.team_name} vs ${team2.team_name}`, margin, y + 2);
  y += 7;

  setInk(MUTED);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  const metaBits = [
    match.tournament?.name || 'Match',
    match.venue ? `${match.venue.name}, ${match.venue.city}` : 'Venue TBC',
    match.match_date
      ? new Date(match.match_date).toLocaleString(undefined, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Date TBC',
    `${match.format} • ${match.overs_per_innings} overs per side`,
  ];
  pdf.splitTextToSize(metaBits.join('  |  '), contentW).forEach((line: string, i: number) => {
    pdf.text(line, margin, y + 2 + i * 4);
  });
  y += 6 + (pdf.splitTextToSize(metaBits.join('  |  '), contentW).length - 1) * 4;

  const tossTeamName =
    match.toss_winner_id === team1.id ? team1.team_name : match.toss_winner_id === team2.id ? team2.team_name : null;
  pdf.text(
    tossTeamName
      ? `Toss: ${tossTeamName} won the toss and elected to ${match.toss_decision === 'bowl' ? 'bowl' : 'bat'} first`
      : 'Toss: not recorded',
    margin,
    y + 2,
  );
  y += 6;

  // Innings score line-up (cricinfo header block)
  innings.forEach((inn, idx) => {
    const battingName = inn.batting_team_id === team1.id ? team1.team_name : team2.team_name;
    const ov = `${Math.floor(inn.total_overs)}.${Math.round((inn.total_overs % 1) * 10)}`;
    checkPage(8);
    setInk(INK);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(battingName, margin, y + 3);
    pdf.text(`${inn.total_runs}/${inn.total_wickets}`, pageW - margin - 22, y + 3, { align: 'right' });
    setInk(MUTED);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(`(${ov} ov)`, pageW - margin, y + 3, { align: 'right' });
    y += 6 + (idx === innings.length - 1 ? 1 : 0);
  });

  if (matchResult) {
    y += 1;
    setInk(ACCENT);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text(matchResult, margin, y + 3);
    y += 7;
  }
  rule(y);
  y += 8;

  // ---------- Innings blocks ----------
  for (let innIdx = 0; innIdx < innings.length; innIdx++) {
    const analysis = analyseInnings(data, innIdx);
    if (!analysis) continue;
    const {
      inn, batTeamName, fullBatsmen, fullBowlers, fow, overGroups,
      extraBreakdown, totalExtras, didNotBat, runRate,
    } = analysis;
    const oversDisplay = `${Math.floor(inn.total_overs)}.${Math.round((inn.total_overs % 1) * 10)}`;

    // Innings banner
    checkPage(14);
    pdf.setFillColor(HEADROW[0], HEADROW[1], HEADROW[2]);
    pdf.rect(margin, y, contentW, 8, 'F');
    pdf.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    pdf.rect(margin, y, 1.4, 8, 'F');
    setInk(INK);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.text(`${batTeamName} Innings`, margin + 4, y + 5.5);
    pdf.text(`${inn.total_runs}/${inn.total_wickets}  (${oversDisplay} ov, RR ${runRate.toFixed(2)})`, pageW - margin - 2, y + 5.5, {
      align: 'right',
    });
    y += 12;

    // Batting table
    const batX = [margin, margin + 62, margin + 112, margin + 124, margin + 136, margin + 148, margin + contentW];
    checkPage(10);
    setInk(MUTED);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.text('BATTING', batX[0], y + 3);
    ['R', 'B', '4s', '6s'].forEach((h, i) => pdf.text(h, batX[2 + i], y + 3, { align: 'right' }));
    pdf.text('SR', batX[6], y + 3, { align: 'right' });
    y += 5;
    rule(y);
    y += 1;

    fullBatsmen.forEach(bat => {
      checkPage(8);
      setInk(INK);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text(bat.name.substring(0, 28), batX[0], y + 4);
      setInk(MUTED);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.text((bat.isOut ? bat.howOut : 'not out').substring(0, 30), batX[1], y + 4);
      setInk(INK);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text(String(bat.runs), batX[2], y + 4, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      pdf.text(String(bat.balls), batX[3], y + 4, { align: 'right' });
      pdf.text(String(bat.fours), batX[4], y + 4, { align: 'right' });
      pdf.text(String(bat.sixes), batX[5], y + 4, { align: 'right' });
      pdf.text(bat.sr.toFixed(2), batX[6], y + 4, { align: 'right' });
      y += 5.6;
      pdf.setDrawColor(238, 238, 238);
      pdf.setLineWidth(0.15);
      pdf.line(margin, y - 0.6, pageW - margin, y - 0.6);
    });

    // Extras + total
    checkPage(14);
    y += 1.5;
    setInk(INK);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text('Extras', batX[0], y + 4);
    setInk(MUTED);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.text(
      `(b ${extraBreakdown.b}, lb ${extraBreakdown.lb}, w ${extraBreakdown.w}, nb ${extraBreakdown.nb})`,
      batX[1],
      y + 4,
    );
    setInk(INK);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text(String(totalExtras || inn.extras), batX[2], y + 4, { align: 'right' });
    y += 6.5;
    rule(y);
    y += 1;

    checkPage(8);
    setInk(INK);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.text('TOTAL', batX[0], y + 4);
    setInk(MUTED);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.text(`${oversDisplay} Ov (RR ${runRate.toFixed(2)})`, batX[1], y + 4);
    setInk(INK);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text(`${inn.total_runs}/${inn.total_wickets}`, batX[6], y + 4, { align: 'right' });
    y += 8;

    if (didNotBat.length) {
      checkPage(10);
      setInk(MUTED);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.text('Did not bat:', margin, y + 3);
      pdf.setFont('helvetica', 'normal');
      pdf.splitTextToSize(didNotBat.join(', '), contentW - 22).forEach((line: string, i: number) => {
        checkPage(5);
        pdf.text(line, margin + 20, y + 3 + i * 3.6);
      });
      y += 4 + Math.max(1, pdf.splitTextToSize(didNotBat.join(', '), contentW - 22).length) * 3.6;
    }

    if (fow.length > 0) {
      checkPage(12);
      setInk(MUTED);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.text('Fall of wickets:', margin, y + 3);
      pdf.setFont('helvetica', 'normal');
      const fowText = fow.map(f => `${f.wicketNum}-${f.score} (${f.batsmanName}, ${f.overs} ov)`).join(', ');
      const lines = pdf.splitTextToSize(fowText, contentW - 26) as string[];
      lines.forEach((line, i) => {
        checkPage(5);
        pdf.text(line, margin + 24, y + 3 + i * 3.6);
      });
      y += 4 + lines.length * 3.6;
    }

    // Bowling table
    y += 3;
    checkPage(14);
    const bowX = [margin, margin + 62, margin + 76, margin + 92, margin + 104, margin + 122, margin + 136, margin + contentW];
    setInk(MUTED);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.text('BOWLING', bowX[0], y + 3);
    ['O', 'M', 'R', 'W', 'ECON', 'WD'].forEach((h, i) => pdf.text(h, bowX[1 + i], y + 3, { align: 'right' }));
    pdf.text('NB', bowX[7], y + 3, { align: 'right' });
    y += 5;
    rule(y);
    y += 1;

    fullBowlers.forEach(bow => {
      checkPage(8);
      setInk(INK);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text(bow.name.substring(0, 28), bowX[0], y + 4);
      pdf.setFont('helvetica', 'normal');
      pdf.text(bow.overs, bowX[1], y + 4, { align: 'right' });
      pdf.text(String(bow.maidens), bowX[2], y + 4, { align: 'right' });
      pdf.text(String(bow.runs), bowX[3], y + 4, { align: 'right' });
      pdf.setFont('helvetica', 'bold');
      pdf.text(String(bow.wickets), bowX[4], y + 4, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      pdf.text(bow.economy, bowX[5], y + 4, { align: 'right' });
      pdf.text(String(bow.wides), bowX[6], y + 4, { align: 'right' });
      pdf.text(String(bow.noBalls), bowX[7], y + 4, { align: 'right' });
      y += 5.6;
      pdf.setDrawColor(238, 238, 238);
      pdf.setLineWidth(0.15);
      pdf.line(margin, y - 0.6, pageW - margin, y - 0.6);
    });

    // Over-by-over
    y += 5;
    sectionTitle('Over by over');
    Array.from(overGroups.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([overNum, overBalls]) => {
        checkPage(8);
        setInk(INK);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.text(`Ov ${overNum + 1}`, margin, y + 3);
        setInk(MUTED);
        pdf.setFont('helvetica', 'normal');
        pdf.text(playerName(overBalls[0]?.bowler_id).substring(0, 20), margin + 12, y + 3);
        setInk(INK);
        pdf.text(overBalls.map(getBallNotation).join('  '), margin + 62, y + 3);
        const overRuns = overBalls.reduce((s, b) => s + b.runs_scored + b.extras, 0);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${overRuns} runs`, pageW - margin, y + 3, { align: 'right' });
        y += 5;
      });

    y += 6;
    rule(y);
    y += 8;
  }

  // ---------- Footer on every page ----------
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
    pdf.setLineWidth(0.2);
    pdf.line(margin, pageH - 12, pageW - margin, pageH - 12);
    setInk(MUTED);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.5);
    pdf.text(`${team1.team_name} v ${team2.team_name} — full scorecard`, margin, pageH - 8);
    pdf.text(`Page ${i} of ${pages}`, pageW - margin, pageH - 8, { align: 'right' });
  }

  const t1 = team1.team_name.replace(/\s+/g, '_');
  const t2 = team2.team_name.replace(/\s+/g, '_');
  pdf.save(`Scorecard_${t1}_vs_${t2}.pdf`);
}
