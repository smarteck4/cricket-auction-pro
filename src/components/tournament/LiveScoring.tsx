import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Match, MatchInnings, MatchBall } from '@/lib/tournament-types';
import { Player, Owner } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, RotateCcw, AlertCircle } from 'lucide-react';
import { MatchSummary } from './MatchSummary';

interface LiveScoringProps {
  match: Match;
  team1: Owner;
  team2: Owner;
  team1Players: Player[];
  team2Players: Player[];
  onClose: () => void;
  onMatchUpdate: () => void;
}

const EXTRA_TYPES = ['LB', 'Bye', 'Wide', 'NB', 'Penalty', 'Ov.Thrw'];

export function LiveScoring({
  match,
  team1,
  team2,
  team1Players,
  team2Players,
  onClose,
  onMatchUpdate,
}: LiveScoringProps) {
  const { toast } = useToast();
  const [innings, setInnings] = useState<MatchInnings[]>([]);
  const [allInningsBalls, setAllInningsBalls] = useState<MatchBall[][]>([]);
  const [currentInnings, setCurrentInnings] = useState<MatchInnings | null>(null);
  const [balls, setBalls] = useState<MatchBall[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');

  // Scoring state
  const [strikerBatsman, setStrikerBatsman] = useState('');
  const [nonStrikerBatsman, setNonStrikerBatsman] = useState('');
  const [currentBowler, setCurrentBowler] = useState('');
  const [runsScored, setRunsScored] = useState(0);
  const [extras, setExtras] = useState(0);
  const [extraType, setExtraType] = useState('');
  const [isWicket, setIsWicket] = useState(false);
  const [wicketType, setWicketType] = useState('');
  const [selectedFielder, setSelectedFielder] = useState('');

  // Track dismissed batsmen and retired hurt
  const [dismissedBatsmen, setDismissedBatsmen] = useState<string[]>([]);
  const [retiredHurtBatsmen, setRetiredHurtBatsmen] = useState<string[]>([]);
  const [previousOverBowler, setPreviousOverBowler] = useState<string>('');
  const [milestoneShown, setMilestoneShown] = useState<{ [key: string]: { fifty: boolean; century: boolean } }>({});

  // Player selection modal state
  type SelectionMode = 'opening' | 'new_batsman' | 'new_bowler' | null;
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(null);
  const [pendingStriker, setPendingStriker] = useState('');
  const [pendingNonStriker, setPendingNonStriker] = useState('');
  const [pendingBowler, setPendingBowler] = useState('');

  // Partnership tracking
  interface Partnership {
    batsman1Id: string;
    batsman2Id: string;
    runs: number;
    balls: number;
    isActive: boolean;
    wicketFellAt?: number;
  }

  // Simple scoring state
  const [simpleMode, setSimpleMode] = useState(true);
  const [team1Score, setTeam1Score] = useState({ runs: 0, wickets: 0, overs: 0 });
  const [team2Score, setTeam2Score] = useState({ runs: 0, wickets: 0, overs: 0 });
  const [winnerId, setWinnerId] = useState('');

  const battingTeam = currentInnings?.batting_team_id === team1.id ? team1 : team2;
  const bowlingTeam = currentInnings?.bowling_team_id === team1.id ? team1 : team2;
  const battingTeamPlayers = currentInnings?.batting_team_id === team1.id ? team1Players : team2Players;
  const bowlingTeamPlayers = currentInnings?.bowling_team_id === team1.id ? team1Players : team2Players;

  // Available batsmen (exclude dismissed, currently batting, but include retired hurt)
  const availableBatsmen = useMemo(() => {
    return battingTeamPlayers.filter(p => 
      !dismissedBatsmen.includes(p.id) && 
      p.id !== strikerBatsman && 
      p.id !== nonStrikerBatsman
    );
  }, [battingTeamPlayers, dismissedBatsmen, strikerBatsman, nonStrikerBatsman]);

  // Available bowlers (exclude the bowler who bowled the previous over)
  const availableBowlers = useMemo(() => {
    return bowlingTeamPlayers.filter(p => p.id !== previousOverBowler);
  }, [bowlingTeamPlayers, previousOverBowler]);

  // Calculate current over and ball from balls array
  const { currentOver, currentBall, legalDeliveries } = useMemo(() => {
    if (!balls.length) return { currentOver: 0, currentBall: 0, legalDeliveries: 0 };
    
    let legal = 0;
    balls.forEach(ball => {
      // Only count legal deliveries (not wides or no balls)
      if (!ball.extra_type || !['wide', 'no_ball'].includes(ball.extra_type)) {
        legal++;
      }
    });
    
    const over = Math.floor(legal / 6);
    const ball = legal % 6;
    return { currentOver: over, currentBall: ball, legalDeliveries: legal };
  }, [balls]);

  // Current over deliveries for display
  const currentOverBalls = useMemo(() => {
    if (!balls.length) return [];
    let legal = 0;
    const overBalls: MatchBall[] = [];
    
    for (const ball of balls) {
      if (!ball.extra_type || !['wide', 'no_ball'].includes(ball.extra_type)) {
        legal++;
      }
      const ballOver = Math.floor((legal - 1) / 6);
      if (ballOver === currentOver || (currentBall === 0 && ballOver === currentOver - 1)) {
        overBalls.push(ball);
      }
    }
    return overBalls.slice(-6);
  }, [balls, currentOver, currentBall]);

  // Calculate batsman stats from balls
  interface BatsmanStats {
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    strikeRate: number;
  }

  const getBatsmanStats = useMemo(() => {
    const statsMap = new Map<string, BatsmanStats>();
    
    balls.forEach(ball => {
      if (ball.batsman_id) {
        const existing = statsMap.get(ball.batsman_id) || { runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0 };
        // Count ball only if it's not a wide (batsman doesn't face wides)
        const isBallFaced = ball.extra_type !== 'wide';
        const runs = ball.runs_scored;
        
        existing.runs += runs;
        existing.balls += isBallFaced ? 1 : 0;
        if (runs === 4) existing.fours++;
        if (runs === 6) existing.sixes++;
        existing.strikeRate = existing.balls > 0 ? (existing.runs / existing.balls) * 100 : 0;
        
        statsMap.set(ball.batsman_id, existing);
      }
    });
    
    return (playerId: string): BatsmanStats => statsMap.get(playerId) || { runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0 };
  }, [balls]);

  // Calculate bowler stats from balls
  interface BowlerStats {
    overs: number;
    maidens: number;
    runs: number;
    wickets: number;
    economy: number;
    legalBalls: number;
  }

  const getBowlerStats = useMemo(() => {
    const statsMap = new Map<string, BowlerStats>();
    const bowlerOversRuns = new Map<string, Map<number, number>>(); // bowler -> over -> runs
    
    balls.forEach(ball => {
      if (ball.bowler_id) {
        const existing = statsMap.get(ball.bowler_id) || { overs: 0, maidens: 0, runs: 0, wickets: 0, economy: 0, legalBalls: 0 };
        const isLegal = !ball.extra_type || !['wide', 'no_ball'].includes(ball.extra_type);
        
        // Runs conceded (includes extras for wide/no ball)
        const runsConceded = ball.runs_scored + ball.extras;
        existing.runs += runsConceded;
        
        if (isLegal) {
          existing.legalBalls++;
        }
        
        // Calculate overs (e.g., 1.4 means 1 over and 4 balls)
        const completedOvers = Math.floor(existing.legalBalls / 6);
        const remainingBalls = existing.legalBalls % 6;
        existing.overs = completedOvers + (remainingBalls / 10);
        
        if (ball.is_wicket && ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket'].includes(ball.wicket_type || '')) {
          existing.wickets++;
        }
        
        // Track runs per over for maiden calculation
        if (!bowlerOversRuns.has(ball.bowler_id)) {
          bowlerOversRuns.set(ball.bowler_id, new Map());
        }
        const overMap = bowlerOversRuns.get(ball.bowler_id)!;
        overMap.set(ball.over_number, (overMap.get(ball.over_number) || 0) + runsConceded);
        
        existing.economy = existing.legalBalls > 0 ? (existing.runs / (existing.legalBalls / 6)) : 0;
        statsMap.set(ball.bowler_id, existing);
      }
    });
    
    // Calculate maidens - only if we track complete overs per bowler
    // For now we skip maiden calculation as it requires tracking over boundaries per bowler
    
    return (playerId: string): BowlerStats => statsMap.get(playerId) || { overs: 0, maidens: 0, runs: 0, wickets: 0, economy: 0, legalBalls: 0 };
  }, [balls]);

  // Calculate partnerships from balls
  const partnerships = useMemo(() => {
    const partnershipList: Partnership[] = [];
    let currentPartnership: Partnership | null = null;
    let runningTotal = 0;
    
    balls.forEach((ball, index) => {
      const isLegal = !ball.extra_type || !['wide', 'no_ball'].includes(ball.extra_type);
      const runsThisBall = ball.runs_scored + ball.extras;
      
      // If no current partnership, start one
      if (!currentPartnership && ball.batsman_id) {
        // Find the non-striker from the next ball or previous context
        const nextBall = balls[index + 1];
        const prevBall = balls[index - 1];
        let partnerId = '';
        
        // Look through balls to find the partner
        for (const b of balls.slice(index)) {
          if (b.batsman_id && b.batsman_id !== ball.batsman_id) {
            partnerId = b.batsman_id;
            break;
          }
        }
        
        if (partnerId) {
          currentPartnership = {
            batsman1Id: ball.batsman_id,
            batsman2Id: partnerId,
            runs: 0,
            balls: 0,
            isActive: true
          };
        }
      }
      
      // Add runs to current partnership
      if (currentPartnership) {
        currentPartnership.runs += runsThisBall;
        if (isLegal) currentPartnership.balls++;
        
        // If wicket, close this partnership
        if (ball.is_wicket) {
          runningTotal += currentPartnership.runs;
          currentPartnership.isActive = false;
          currentPartnership.wicketFellAt = runningTotal;
          partnershipList.push({ ...currentPartnership });
          currentPartnership = null;
        }
      }
    });
    
    // Add current active partnership
    if (currentPartnership) {
      partnershipList.push(currentPartnership);
    }
    
    return partnershipList;
  }, [balls]);

  // Get current partnership (last active one)
  const currentPartnership = useMemo(() => {
    return partnerships.find(p => p.isActive) || (partnerships.length > 0 ? partnerships[partnerships.length - 1] : null);
  }, [partnerships]);

  // Calculate required run rate and current run rate
  const { target, reqRR, currentRR } = useMemo(() => {
    if (!currentInnings || innings.length < 2) return { target: 0, reqRR: 0, currentRR: 0 };
    
    const firstInnings = innings.find(i => i.innings_number === 1);
    if (!firstInnings || currentInnings.innings_number !== 2) return { target: 0, reqRR: 0, currentRR: 0 };
    
    const targetRuns = firstInnings.total_runs + 1;
    const runsNeeded = targetRuns - currentInnings.total_runs;
    const ballsRemaining = (match.overs_per_innings * 6) - legalDeliveries;
    const oversRemaining = ballsRemaining / 6;
    
    const reqRate = oversRemaining > 0 ? (runsNeeded / oversRemaining) : 0;
    const currRate = legalDeliveries > 0 ? (currentInnings.total_runs / (legalDeliveries / 6)) : 0;
    
    return { target: targetRuns, reqRR: reqRate, currentRR: currRate };
  }, [currentInnings, innings, match.overs_per_innings, legalDeliveries]);

  // Determine if we need player selection
  const needsPlayerSelection = useMemo(() => {
    if (!currentInnings) return false;
    // Opening selection - no players selected yet
    if (!strikerBatsman || !nonStrikerBatsman || !currentBowler) {
      return true;
    }
    return false;
  }, [currentInnings, strikerBatsman, nonStrikerBatsman, currentBowler]);

  // Auto-trigger opening selection only when innings has no balls yet
  useEffect(() => {
    if (currentInnings && !strikerBatsman && !nonStrikerBatsman && !currentBowler && !selectionMode && balls.length === 0) {
      setSelectionMode('opening');
      setPendingStriker('');
      setPendingNonStriker('');
      setPendingBowler('');
    }
  }, [currentInnings, strikerBatsman, nonStrikerBatsman, currentBowler, selectionMode, balls.length]);

  useEffect(() => {
    fetchInnings();
  }, [match.id]);

  const fetchInnings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('match_innings')
      .select('*')
      .eq('match_id', match.id)
      .order('innings_number');

    if (data) {
      setInnings(data as MatchInnings[]);
      const active = data.find((i) => !i.is_completed);
      if (active) {
        setCurrentInnings(active as MatchInnings);
        fetchBalls(active.id);
      }

      // Fetch balls for all innings for summary
      const ballsPromises = data.map((inn) => fetchBallsForInnings(inn.id));
      const allBalls = await Promise.all(ballsPromises);
      setAllInningsBalls(allBalls);

      const inn1 = data.find((i) => i.innings_number === 1);
      const inn2 = data.find((i) => i.innings_number === 2);
      if (inn1) setTeam1Score({ runs: inn1.total_runs, wickets: inn1.total_wickets, overs: inn1.total_overs });
      if (inn2) setTeam2Score({ runs: inn2.total_runs, wickets: inn2.total_wickets, overs: inn2.total_overs });
    }
    setLoading(false);
  };

  const fetchBallsForInnings = async (inningsId: string): Promise<MatchBall[]> => {
    const { data } = await supabase
      .from('match_balls')
      .select('*')
      .eq('innings_id', inningsId)
      .order('created_at');
    return (data as MatchBall[]) || [];
  };

  const reconstructStateFromBalls = (ballsData: MatchBall[]) => {
    if (!ballsData.length) return;

    // Build dismissed batsmen list
    const dismissed: string[] = [];
    ballsData.forEach(ball => {
      if (ball.is_wicket && ball.batsman_id) {
        dismissed.push(ball.batsman_id);
      }
    });
    setDismissedBatsmen(dismissed);

    // Determine current striker & non-striker by replaying strike rotation
    let striker = '';
    let nonStriker = '';

    // Find the opening pair from the first two distinct batsmen
    const seenBatsmen: string[] = [];
    for (const ball of ballsData) {
      if (ball.batsman_id && !seenBatsmen.includes(ball.batsman_id)) {
        seenBatsmen.push(ball.batsman_id);
        if (seenBatsmen.length === 2) break;
      }
    }

    if (seenBatsmen.length >= 2) {
      striker = seenBatsmen[0];
      nonStriker = seenBatsmen[1];
    } else if (seenBatsmen.length === 1) {
      striker = seenBatsmen[0];
    }

    // Replay all balls to track strike rotation and new batsmen
    for (const ball of ballsData) {
      const isLegal = !ball.extra_type || !['wide', 'no_ball'].includes(ball.extra_type);

      // If a wicket happened, the dismissed batsman is replaced by the next new batsman
      if (ball.is_wicket && ball.batsman_id) {
        // Find who replaced this batsman – look ahead for a new batsman_id
        const nextNewBatsman = ballsData
          .slice(ballsData.indexOf(ball) + 1)
          .find(b => b.batsman_id && b.batsman_id !== striker && b.batsman_id !== nonStriker && !dismissed.includes(b.batsman_id));
        
        if (ball.batsman_id === striker) {
          striker = nextNewBatsman?.batsman_id || '';
        } else if (ball.batsman_id === nonStriker) {
          nonStriker = nextNewBatsman?.batsman_id || '';
        }
      }

      // Rotate strike on odd runs
      if (ball.runs_scored % 2 === 1) {
        const temp = striker;
        striker = nonStriker;
        nonStriker = temp;
      }
    }

    // Count legal deliveries to check if we're at end of over (strike rotates)
    let legalCount = 0;
    let lastOverBoundary = 0;
    for (const ball of ballsData) {
      const isLegal = !ball.extra_type || !['wide', 'no_ball'].includes(ball.extra_type);
      if (isLegal) legalCount++;
      if (isLegal && legalCount % 6 === 0) {
        // Over boundary - swap strike
        const temp = striker;
        striker = nonStriker;
        nonStriker = temp;
        lastOverBoundary = legalCount;
      }
    }

    // Determine current bowler and previous over bowler
    const lastBall = ballsData[ballsData.length - 1];
    const currentBowlerId = lastBall?.bowler_id || '';
    
    // Find previous over's bowler
    let prevOverBowler = '';
    if (legalCount > 0) {
      const currentOverNum = Math.floor((legalCount - 1) / 6);
      // Find a ball from the previous over
      let prevLegal = 0;
      for (const ball of ballsData) {
        const isLegal = !ball.extra_type || !['wide', 'no_ball'].includes(ball.extra_type);
        if (isLegal) prevLegal++;
        const overOfBall = Math.floor((prevLegal - 1) / 6);
        if (overOfBall === currentOverNum - 1 && ball.bowler_id) {
          prevOverBowler = ball.bowler_id;
        }
      }
    }

    // Check if we're exactly at end of over (need new bowler)
    const atOverEnd = legalCount > 0 && legalCount % 6 === 0;
    // Check if last ball was a wicket (need new batsman)
    const lastWasWicket = lastBall?.is_wicket && !dismissed.includes(striker) ? false : (lastBall?.is_wicket && striker === '');

    // Set state
    if (striker && !dismissed.includes(striker)) {
      setStrikerBatsman(striker);
    }
    if (nonStriker && !dismissed.includes(nonStriker)) {
      setNonStrikerBatsman(nonStriker);
    }

    setPreviousOverBowler(prevOverBowler);

    if (atOverEnd) {
      // Need new bowler selection
      setPreviousOverBowler(currentBowlerId);
      setCurrentBowler('');
      setSelectionMode('new_bowler');
      setPendingBowler('');
    } else {
      setCurrentBowler(currentBowlerId);
    }

    // If striker is empty (wicket on last ball), need new batsman
    if (!striker || dismissed.includes(striker)) {
      setStrikerBatsman('');
      if (!atOverEnd) {
        setSelectionMode('new_batsman');
        setPendingStriker('');
      }
    }
  };

  const fetchBalls = async (inningsId: string) => {
    const { data } = await supabase
      .from('match_balls')
      .select('*')
      .eq('innings_id', inningsId)
      .order('created_at');

    if (data) {
      const ballsData = data as MatchBall[];
      setBalls(ballsData);
      reconstructStateFromBalls(ballsData);
    }
  };

  const startInnings = async (battingTeamId: string, bowlingTeamId: string) => {
    const inningsNumber = innings.length + 1;
    const { data, error } = await supabase
      .from('match_innings')
      .insert({
        match_id: match.id,
        batting_team_id: battingTeamId,
        bowling_team_id: bowlingTeamId,
        innings_number: inningsNumber,
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    if (match.status === 'scheduled') {
      await supabase.from('matches').update({ status: 'live' }).eq('id', match.id);
      onMatchUpdate();
    }

    toast({ title: 'Innings Started', description: `Innings ${inningsNumber} has begun` });
    fetchInnings();
  };

  const recordBall = async (runs: number, isExtra = false, extraTypeVal = '') => {
    if (!currentInnings) return;
    
    if (!strikerBatsman || !currentBowler) {
      toast({ title: 'Select Players', description: 'Please select striker and bowler', variant: 'destructive' });
      return;
    }

    const isLegalDelivery = !extraTypeVal || !['wide', 'no_ball'].includes(extraTypeVal);
    const newLegalDeliveries = isLegalDelivery ? legalDeliveries + 1 : legalDeliveries;
    
    // Calculate over and ball for this delivery
    const overNum = Math.floor(newLegalDeliveries / 6);
    const ballNum = isLegalDelivery ? ((legalDeliveries % 6) + 1) : (legalDeliveries % 6);

    const extraRuns = isExtra ? 1 : 0;

    const { error } = await supabase.from('match_balls').insert({
      innings_id: currentInnings.id,
      over_number: currentOver,
      ball_number: ballNum,
      batsman_id: strikerBatsman,
      bowler_id: currentBowler,
      runs_scored: runs,
      extras: extraRuns,
      extra_type: extraTypeVal || null,
      is_wicket: isWicket,
      wicket_type: isWicket ? wicketType : null,
      fielder_id: selectedFielder || null,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    const newTotalRuns = currentInnings.total_runs + runs + extraRuns;
    const newTotalWickets = currentInnings.total_wickets + (isWicket ? 1 : 0);
    const newTotalOvers = isLegalDelivery ? (overNum + (ballNum === 6 ? 0 : ballNum / 10)) : currentInnings.total_overs;

    await supabase
      .from('match_innings')
      .update({
        total_runs: newTotalRuns,
        total_wickets: newTotalWickets,
        total_overs: newTotalOvers,
      })
      .eq('id', currentInnings.id);

    // Check for automatic innings end conditions
    const maxOvers = match.overs_per_innings;
    const maxWickets = 10;
    const allOversCompleted = isLegalDelivery && newLegalDeliveries >= maxOvers * 6;
    const allOut = newTotalWickets >= maxWickets;

    // For second innings: check if target is chased
    const firstInnings = innings.find(i => i.innings_number === 1);
    const isSecondInnings = currentInnings.innings_number === 2;
    const targetRuns = firstInnings ? firstInnings.total_runs + 1 : 0;
    const targetChased = isSecondInnings && newTotalRuns >= targetRuns;

    // Auto-complete match if target chased
    if (targetChased) {
      // Mark innings as completed
      await supabase.from('match_innings').update({ is_completed: true }).eq('id', currentInnings.id);
      // Chasing team wins
      await supabase.from('matches').update({ 
        status: 'completed', 
        winner_id: currentInnings.batting_team_id 
      }).eq('id', match.id);
      
      const winningTeam = currentInnings.batting_team_id === team1.id ? team1 : team2;
      const wicketsRemaining = maxWickets - newTotalWickets;
      toast({ 
        title: '🏆 Match Over!', 
        description: `${winningTeam.team_name} wins by ${wicketsRemaining} wickets!` 
      });
      onMatchUpdate();
      fetchInnings();
      return;
    }

    // Auto-end innings if all overs completed or all out
    if (allOversCompleted || allOut) {
      // Mark current innings as completed
      await supabase.from('match_innings').update({ is_completed: true }).eq('id', currentInnings.id);

      if (isSecondInnings) {
        // Second innings ended without chasing target - first batting team wins
        const firstBattingTeamId = firstInnings?.batting_team_id;
        const firstBattingTeam = firstBattingTeamId === team1.id ? team1 : team2;
        const margin = targetRuns - 1 - newTotalRuns;
        
        await supabase.from('matches').update({ 
          status: 'completed', 
          winner_id: firstBattingTeamId 
        }).eq('id', match.id);
        
        toast({ 
          title: '🏆 Match Over!', 
          description: `${firstBattingTeam.team_name} wins by ${margin} runs!` 
        });
        onMatchUpdate();
        fetchInnings();
        return;
      } else {
        // First innings ended - auto-start second innings
        const reason = allOut ? 'All out' : 'Overs completed';
        toast({ 
          title: `1st Innings Completed`, 
          description: `${reason}. Starting 2nd innings...` 
        });
        
        // Reset player states for new innings
        setStrikerBatsman('');
        setNonStrikerBatsman('');
        setCurrentBowler('');
        setDismissedBatsmen([]);
        setRetiredHurtBatsmen([]);
        setPreviousOverBowler('');
        setMilestoneShown({});
        
        // Auto-start second innings (swap batting/bowling teams)
        await startInnings(currentInnings.bowling_team_id, currentInnings.batting_team_id);
        return;
      }
    }

    // Rotate strike on odd runs (1, 3, 5)
    if (runs % 2 === 1) {
      const temp = strikerBatsman;
      setStrikerBatsman(nonStrikerBatsman);
      setNonStrikerBatsman(temp);
    }

    // Auto rotate strike at end of over (after 6 legal deliveries)
    if (isLegalDelivery && ballNum === 6) {
      const temp = strikerBatsman;
      setStrikerBatsman(nonStrikerBatsman);
      setNonStrikerBatsman(temp);
      
      // Set previous over bowler to enforce bowler change
      setPreviousOverBowler(currentBowler);
      setCurrentBowler(''); // Force bowler selection for next over
      
      // Trigger bowler selection modal
      setSelectionMode('new_bowler');
      setPendingBowler('');
      
      toast({ title: 'Over Complete', description: `Over ${currentOver + 1} completed. Please select a new bowler.` });
    }

    // Handle wicket - add batsman to dismissed list (only if innings not ended)
    if (isWicket && newTotalWickets < maxWickets) {
      setDismissedBatsmen(prev => [...prev, strikerBatsman]);
      setStrikerBatsman('');
      setIsWicket(false);
      setWicketType('');
      setSelectedFielder('');
      
      // Trigger new batsman selection modal
      setSelectionMode('new_batsman');
      setPendingStriker('');
    } else if (isWicket) {
      // Reset wicket state even if innings ended
      setIsWicket(false);
      setWicketType('');
      setSelectedFielder('');
    }

    // Check for milestone notifications (50 or 100 runs)
    const updatedStats = getBatsmanStats(strikerBatsman);
    const newBatsmanRuns = updatedStats.runs + runs;
    const playerName = battingTeamPlayers.find(p => p.id === strikerBatsman)?.name || 'Batsman';
    const playerMilestones = milestoneShown[strikerBatsman] || { fifty: false, century: false };
    
    if (newBatsmanRuns >= 100 && !playerMilestones.century) {
      toast({ 
        title: '🎉 CENTURY! 💯', 
        description: `${playerName} reaches a magnificent century!`,
      });
      setMilestoneShown(prev => ({ ...prev, [strikerBatsman]: { ...playerMilestones, century: true, fifty: true } }));
    } else if (newBatsmanRuns >= 50 && newBatsmanRuns < 100 && !playerMilestones.fifty) {
      toast({ 
        title: '🎉 FIFTY! 5️⃣0️⃣', 
        description: `${playerName} reaches a well-deserved half-century!`,
      });
      setMilestoneShown(prev => ({ ...prev, [strikerBatsman]: { ...playerMilestones, fifty: true } }));
    }

    fetchInnings();
  };

  const handleRetiredHurt = () => {
    if (!strikerBatsman) return;
    setRetiredHurtBatsmen(prev => [...prev, strikerBatsman]);
    setStrikerBatsman('');
    
    // Trigger new batsman selection modal
    setSelectionMode('new_batsman');
    setPendingStriker('');
    
    toast({ title: 'Retired Hurt', description: 'Batsman marked as retired hurt. Select new batsman.' });
  };

  // Confirm player selection from modal
  const confirmPlayerSelection = () => {
    if (selectionMode === 'opening') {
      if (!pendingStriker || !pendingNonStriker || !pendingBowler) {
        toast({ title: 'Select All Players', description: 'Please select both openers and the bowler.', variant: 'destructive' });
        return;
      }
      setStrikerBatsman(pendingStriker);
      setNonStrikerBatsman(pendingNonStriker);
      setCurrentBowler(pendingBowler);
    } else if (selectionMode === 'new_batsman') {
      if (!pendingStriker) {
        toast({ title: 'Select Batsman', description: 'Please select the new batsman.', variant: 'destructive' });
        return;
      }
      setStrikerBatsman(pendingStriker);
    } else if (selectionMode === 'new_bowler') {
      if (!pendingBowler) {
        toast({ title: 'Select Bowler', description: 'Please select the new bowler.', variant: 'destructive' });
        return;
      }
      setCurrentBowler(pendingBowler);
    }
    setSelectionMode(null);
  };

  const bringBackRetiredHurt = (playerId: string) => {
    setRetiredHurtBatsmen(prev => prev.filter(id => id !== playerId));
    if (!strikerBatsman) {
      setStrikerBatsman(playerId);
    } else if (!nonStrikerBatsman) {
      setNonStrikerBatsman(playerId);
    }
    toast({ title: 'Batsman Returned', description: 'Retired hurt batsman is back.' });
  };

  const undoLastBall = async () => {
    if (!balls.length || !currentInnings) return;
    
    const lastBall = balls[balls.length - 1];
    await supabase.from('match_balls').delete().eq('id', lastBall.id);
    
    const runsToRemove = lastBall.runs_scored + lastBall.extras;
    const wicketsToRemove = lastBall.is_wicket ? 1 : 0;
    
    await supabase
      .from('match_innings')
      .update({
        total_runs: currentInnings.total_runs - runsToRemove,
        total_wickets: currentInnings.total_wickets - wicketsToRemove,
      })
      .eq('id', currentInnings.id);

    toast({ title: 'Undone', description: 'Last ball removed' });
    fetchInnings();
  };

  const endInnings = async () => {
    if (!currentInnings) return;
    await supabase.from('match_innings').update({ is_completed: true }).eq('id', currentInnings.id);
    toast({ title: 'Innings Completed' });
    fetchInnings();
  };

  const saveSimpleScore = async () => {
    const existingInn1 = innings.find((i) => i.innings_number === 1);
    const existingInn2 = innings.find((i) => i.innings_number === 2);

    if (existingInn1) {
      await supabase.from('match_innings').update({
        total_runs: team1Score.runs,
        total_wickets: team1Score.wickets,
        total_overs: team1Score.overs,
        is_completed: true,
      }).eq('id', existingInn1.id);
    } else if (team1Score.runs > 0 || team1Score.wickets > 0) {
      await supabase.from('match_innings').insert({
        match_id: match.id,
        batting_team_id: team1.id,
        bowling_team_id: team2.id,
        innings_number: 1,
        total_runs: team1Score.runs,
        total_wickets: team1Score.wickets,
        total_overs: team1Score.overs,
        is_completed: true,
      });
    }

    if (existingInn2) {
      await supabase.from('match_innings').update({
        total_runs: team2Score.runs,
        total_wickets: team2Score.wickets,
        total_overs: team2Score.overs,
        is_completed: true,
      }).eq('id', existingInn2.id);
    } else if (team2Score.runs > 0 || team2Score.wickets > 0) {
      await supabase.from('match_innings').insert({
        match_id: match.id,
        batting_team_id: team2.id,
        bowling_team_id: team1.id,
        innings_number: 2,
        total_runs: team2Score.runs,
        total_wickets: team2Score.wickets,
        total_overs: team2Score.overs,
        is_completed: true,
      });
    }

    toast({ title: 'Scores Saved' });
    fetchInnings();
  };

  const completeMatch = async () => {
    await supabase.from('matches').update({ status: 'completed', winner_id: winnerId || null }).eq('id', match.id);
    toast({ title: 'Match Completed' });
    onMatchUpdate();
    onClose();
  };

  const getBallDisplay = (ball: MatchBall) => {
    if (ball.is_wicket) return 'W';
    if (ball.extra_type === 'wide') return `${ball.runs_scored}Wd`;
    if (ball.extra_type === 'no_ball') return `${ball.runs_scored}Nb`;
    if (ball.extra_type === 'bye') return `${ball.runs_scored}B`;
    if (ball.extra_type === 'leg_bye') return `${ball.runs_scored}Lb`;
    return ball.runs_scored.toString();
  };

  const getPlayerName = (id: string | null) => {
    if (!id) return 'Unknown';
    const player = [...battingTeamPlayers, ...bowlingTeamPlayers].find(p => p.id === id);
    return player?.name || 'Unknown';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[85vh]">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b bg-primary text-primary-foreground rounded-t-lg">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-primary-foreground hover:bg-primary/80">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="font-semibold">Match Centre</span>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-5 bg-primary rounded-none">
          <TabsTrigger value="summary" className="text-primary-foreground data-[state=active]:bg-primary/80 text-xs sm:text-sm">Summary</TabsTrigger>
          <TabsTrigger value="scoring" className="text-primary-foreground data-[state=active]:bg-primary/80 text-xs sm:text-sm">Scoring</TabsTrigger>
          <TabsTrigger value="scorecard" className="text-primary-foreground data-[state=active]:bg-primary/80 text-xs sm:text-sm">Scorecard</TabsTrigger>
          <TabsTrigger value="balls" className="text-primary-foreground data-[state=active]:bg-primary/80 text-xs sm:text-sm">Balls</TabsTrigger>
          <TabsTrigger value="info" className="text-primary-foreground data-[state=active]:bg-primary/80 text-xs sm:text-sm">Info</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="flex-1 overflow-auto p-0 m-0">
          <MatchSummary
            match={match}
            team1={team1}
            team2={team2}
            team1Players={team1Players}
            team2Players={team2Players}
            innings={innings}
            allBalls={allInningsBalls}
          />
        </TabsContent>

        <TabsContent value="scoring" className="flex-1 flex flex-col overflow-auto p-0 m-0">
          {currentInnings ? (
            <div className="flex flex-col flex-1 relative">
              {/* Score Display */}
              <div className="bg-gradient-to-b from-card to-muted text-card-foreground p-4 text-center border-b">
                <p className="text-sm text-muted-foreground">{battingTeam.team_name}</p>
                <p className="text-xs text-muted-foreground">Innings {currentInnings.innings_number}</p>
                <p className="text-5xl font-bold text-primary my-2">
                  {currentInnings.total_runs}-{currentInnings.total_wickets}
                </p>
                <div className="flex justify-center gap-6 text-sm text-muted-foreground">
                  <span>Ex - {currentInnings.extras}</span>
                  <span>Ov - {currentOver}.{currentBall}/{match.overs_per_innings}</span>
                  <span>CRR - {currentRR.toFixed(1)}</span>
                </div>
                {target > 0 && (
                  <div className="mt-2 text-sm">
                    <span className="text-muted-foreground">Target {target}</span>
                    <span className="mx-2">•</span>
                    <span className="text-muted-foreground">Req. RR - {reqRR.toFixed(1)}</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Need {target - currentInnings.total_runs} Runs of {(match.overs_per_innings * 6) - legalDeliveries}
                    </p>
                  </div>
                )}
              </div>

              {/* Player Selection Modal Overlay */}
              {selectionMode && (
                <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
                  <div className="p-4 border-b bg-primary text-primary-foreground">
                    <h3 className="text-lg font-semibold text-center">
                      {selectionMode === 'opening' && '🏏 Select Opening Players'}
                      {selectionMode === 'new_batsman' && '🏏 Select New Batsman'}
                      {selectionMode === 'new_bowler' && '🏐 Select New Bowler'}
                    </h3>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-4 space-y-4">
                    {/* Opening selection or new batsman */}
                    {(selectionMode === 'opening' || selectionMode === 'new_batsman') && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">
                          {selectionMode === 'opening' ? 'Striker (Opening Batsman)' : 'New Batsman'}
                        </Label>
                        <Select value={pendingStriker} onValueChange={setPendingStriker}>
                          <SelectTrigger className="w-full h-12 text-base">
                            <SelectValue placeholder="Select batsman..." />
                          </SelectTrigger>
                          <SelectContent className="bg-background border shadow-lg z-[60]">
                            {availableBatsmen.filter(p => p.id !== pendingNonStriker && p.id !== nonStrikerBatsman).map((p) => (
                              <SelectItem key={p.id} value={p.id} className="py-3">
                                {p.name}
                                {retiredHurtBatsmen.includes(p.id) && <span className="ml-2 text-warning">(Retired Hurt)</span>}
                              </SelectItem>
                            ))}
                            {retiredHurtBatsmen.length > 0 && selectionMode === 'new_batsman' && (
                              <>
                                <div className="px-2 py-2 text-xs font-semibold text-muted-foreground border-t mt-1 bg-muted">Retired Hurt Players</div>
                                {retiredHurtBatsmen.map((id) => {
                                  const player = battingTeamPlayers.find(p => p.id === id);
                                  if (!player || id === nonStrikerBatsman) return null;
                                  return (
                                    <SelectItem key={id} value={id} className="py-3 text-warning">
                                      {player.name} (Retired Hurt - can return)
                                    </SelectItem>
                                  );
                                })}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {selectionMode === 'opening' && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Non-Striker (Opening Batsman)</Label>
                        <Select value={pendingNonStriker} onValueChange={setPendingNonStriker}>
                          <SelectTrigger className="w-full h-12 text-base">
                            <SelectValue placeholder="Select batsman..." />
                          </SelectTrigger>
                          <SelectContent className="bg-background border shadow-lg z-[60]">
                            {availableBatsmen.filter(p => p.id !== pendingStriker).map((p) => (
                              <SelectItem key={p.id} value={p.id} className="py-3">
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {/* Opening selection or new bowler */}
                    {(selectionMode === 'opening' || selectionMode === 'new_bowler') && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">
                          {selectionMode === 'opening' ? 'Opening Bowler' : 'New Bowler'}
                        </Label>
                        {selectionMode === 'new_bowler' && previousOverBowler && (
                          <p className="text-xs text-muted-foreground">
                            {bowlingTeamPlayers.find(p => p.id === previousOverBowler)?.name} bowled the previous over
                          </p>
                        )}
                        <Select value={pendingBowler} onValueChange={setPendingBowler}>
                          <SelectTrigger className="w-full h-12 text-base">
                            <SelectValue placeholder="Select bowler..." />
                          </SelectTrigger>
                          <SelectContent className="bg-background border shadow-lg z-[60]">
                            {availableBowlers.map((p) => (
                              <SelectItem key={p.id} value={p.id} className="py-3">
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 border-t bg-muted">
                    <Button onClick={confirmPlayerSelection} className="w-full h-12 text-base font-semibold">
                      Confirm Selection
                    </Button>
                  </div>
                </div>
              )}

              {/* Batsmen & Bowler Stats - Clean Display (no dropdowns) */}
              <div className="bg-background p-3 border-b">
                <div className="text-xs text-muted-foreground mb-2 flex justify-between">
                  <span>🏏 Batsman</span>
                  <div className="flex gap-4 text-center">
                    <span className="w-8">R</span>
                    <span className="w-8">B</span>
                    <span className="w-8">4s</span>
                    <span className="w-8">6s</span>
                    <span className="w-12">SR</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {/* Striker */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-primary font-bold">🏏</span>
                      <span className="text-sm font-medium w-36 truncate">
                        {strikerBatsman ? getPlayerName(strikerBatsman) : <span className="text-muted-foreground italic">Striker *</span>}
                      </span>
                    </div>
                    {strikerBatsman ? (
                      <div className="flex gap-4 text-sm text-center font-medium">
                        <span className="w-8 text-primary">{getBatsmanStats(strikerBatsman).runs}</span>
                        <span className="w-8">{getBatsmanStats(strikerBatsman).balls}</span>
                        <span className="w-8 text-accent-foreground">{getBatsmanStats(strikerBatsman).fours}</span>
                        <span className="w-8 text-secondary-foreground">{getBatsmanStats(strikerBatsman).sixes}</span>
                        <span className="w-12 text-muted-foreground">{getBatsmanStats(strikerBatsman).strikeRate.toFixed(1)}</span>
                      </div>
                    ) : (
                      <div className="flex gap-4 text-sm text-center text-muted-foreground">
                        <span className="w-8">-</span>
                        <span className="w-8">-</span>
                        <span className="w-8">-</span>
                        <span className="w-8">-</span>
                        <span className="w-12">-</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Non-Striker */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-5"></span>
                      <span className="text-sm w-36 truncate">
                        {nonStrikerBatsman ? getPlayerName(nonStrikerBatsman) : <span className="text-muted-foreground italic">Non-Striker</span>}
                      </span>
                    </div>
                    {nonStrikerBatsman ? (
                      <div className="flex gap-4 text-sm text-center">
                        <span className="w-8">{getBatsmanStats(nonStrikerBatsman).runs}</span>
                        <span className="w-8">{getBatsmanStats(nonStrikerBatsman).balls}</span>
                        <span className="w-8">{getBatsmanStats(nonStrikerBatsman).fours}</span>
                        <span className="w-8">{getBatsmanStats(nonStrikerBatsman).sixes}</span>
                        <span className="w-12">{getBatsmanStats(nonStrikerBatsman).strikeRate.toFixed(1)}</span>
                      </div>
                    ) : (
                      <div className="flex gap-4 text-sm text-center text-muted-foreground">
                        <span className="w-8">-</span>
                        <span className="w-8">-</span>
                        <span className="w-8">-</span>
                        <span className="w-8">-</span>
                        <span className="w-12">-</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bowler Stats */}
                <div className="mt-3 pt-3 border-t">
                  <div className="text-xs text-muted-foreground mb-2 flex justify-between">
                    <span>🏐 Bowler</span>
                    <div className="flex gap-4 text-center">
                      <span className="w-8">O</span>
                      <span className="w-8">M</span>
                      <span className="w-8">R</span>
                      <span className="w-8">W</span>
                      <span className="w-12">Eco</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium w-40 truncate">
                      {currentBowler ? getPlayerName(currentBowler) : <span className="text-muted-foreground italic">Bowler *</span>}
                    </span>
                    {currentBowler ? (
                      <div className="flex gap-4 text-sm text-center font-medium">
                        <span className="w-8">{getBowlerStats(currentBowler).overs.toFixed(1)}</span>
                        <span className="w-8">{getBowlerStats(currentBowler).maidens}</span>
                        <span className="w-8 text-destructive">{getBowlerStats(currentBowler).runs}</span>
                        <span className="w-8 text-primary">{getBowlerStats(currentBowler).wickets}</span>
                        <span className="w-12 text-muted-foreground">{getBowlerStats(currentBowler).economy.toFixed(2)}</span>
                      </div>
                    ) : (
                      <div className="flex gap-4 text-sm text-center text-muted-foreground">
                        <span className="w-8">-</span>
                        <span className="w-8">-</span>
                        <span className="w-8">-</span>
                        <span className="w-8">-</span>
                        <span className="w-12">-</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Current Partnership Display */}
                {currentPartnership && (strikerBatsman || nonStrikerBatsman) && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">🤝 Partnership:</span>
                        <span className="text-sm font-semibold text-primary">{currentPartnership.runs}</span>
                        <span className="text-xs text-muted-foreground">({currentPartnership.balls} balls)</span>
                      </div>
                      {currentPartnership.balls > 0 && (
                        <span className="text-xs text-muted-foreground">
                          RR: {((currentPartnership.runs / currentPartnership.balls) * 6).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{getPlayerName(strikerBatsman)} & {getPlayerName(nonStrikerBatsman)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* This Over Display */}
              <div className="bg-muted p-2 flex items-center gap-2 border-b">
                <span className="text-xs text-muted-foreground">Over {currentOver + 1}:</span>
                <div className="flex gap-1 flex-wrap">
                  {currentOverBalls.map((ball, i) => (
                    <Badge
                      key={i}
                      variant={ball.is_wicket ? 'destructive' : 'secondary'}
                      className={`text-xs ${ball.runs_scored >= 4 ? 'bg-primary text-primary-foreground' : ''}`}
                    >
                      {getBallDisplay(ball)}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Run Buttons */}
              <div className="p-3 bg-background flex-1">
                <div className="grid grid-cols-6 gap-2 mb-3">
                  {[1, 2, 3, 4, 5, 6].map((run) => (
                    <Button
                      key={run}
                      onClick={() => recordBall(run)}
                      className={`h-12 text-lg font-bold ${run === 4 || run === 6 ? 'bg-primary hover:bg-primary/90' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
                    >
                      {run}
                    </Button>
                  ))}
                </div>

                {/* Extras Row */}
                <div className="grid grid-cols-7 gap-2 mb-3">
                  <Button variant="outline" onClick={() => recordBall(0, true, 'leg_bye')} className="text-xs">LB</Button>
                  <Button variant="outline" onClick={() => recordBall(0, true, 'bye')} className="text-xs">Bye</Button>
                  <Button variant="outline" onClick={() => recordBall(1, true, 'wide')} className="text-xs">Wide</Button>
                  <Button variant="outline" onClick={() => recordBall(1, true, 'no_ball')} className="text-xs">NB</Button>
                  <Button variant="outline" onClick={undoLastBall} className="text-xs"><RotateCcw className="h-4 w-4" /></Button>
                  <Button 
                    variant={isWicket ? 'destructive' : 'outline'} 
                    onClick={() => setIsWicket(!isWicket)}
                    className="text-xs"
                  >
                    Out
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleRetiredHurt}
                    className="text-xs text-warning border-warning/50"
                    disabled={!strikerBatsman}
                  >
                    R.Hurt
                  </Button>
                </div>

                {/* Wicket Selection */}
                {isWicket && (
                  <div className="p-3 bg-destructive/10 rounded-lg mb-3 space-y-2">
                    <Label className="text-sm text-destructive">Wicket Type</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {['bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket'].map((wt) => (
                        <Button
                          key={wt}
                          size="sm"
                          variant={wicketType === wt ? 'destructive' : 'outline'}
                          onClick={() => setWicketType(wt)}
                          className="text-xs"
                        >
                          {wt.replace('_', ' ').toUpperCase()}
                        </Button>
                      ))}
                    </div>
                    {['caught', 'run_out', 'stumped'].includes(wicketType) && (
                      <Select value={selectedFielder} onValueChange={setSelectedFielder}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select fielder" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-lg z-50">
                          {bowlingTeamPlayers.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button
                      onClick={() => recordBall(0)}
                      className="w-full mt-2"
                      variant="destructive"
                      disabled={!wicketType}
                    >
                      Record Wicket
                    </Button>
                  </div>
                )}

                {/* Dot Ball */}
                <Button
                  onClick={() => recordBall(0)}
                  variant="secondary"
                  className="w-full h-10"
                  disabled={isWicket}
                >
                  0 (Dot Ball)
                </Button>

                {/* End Innings Button */}
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" onClick={endInnings} className="flex-1">
                    End Innings
                  </Button>
                  {innings.length >= 2 && innings.every((i) => i.is_completed) && (
                    <Button onClick={completeMatch} className="flex-1">
                      Complete Match
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Start Innings */
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold">Start Innings {innings.length + 1}</h3>
              <p className="text-sm text-muted-foreground">Select which team will bat first</p>
              <div className="grid grid-cols-2 gap-4">
                <Button onClick={() => startInnings(team1.id, team2.id)} className="h-24 flex-col">
                  <span className="text-lg font-bold">{team1.team_name}</span>
                  <span className="text-sm opacity-70">Bats First</span>
                </Button>
                <Button onClick={() => startInnings(team2.id, team1.id)} className="h-24 flex-col" variant="outline">
                  <span className="text-lg font-bold">{team2.team_name}</span>
                  <span className="text-sm opacity-70">Bats First</span>
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="scorecard" className="p-4 overflow-auto">
          {innings.length > 0 ? (
            <div className="space-y-4">
              {innings.map((inn) => (
                <div key={inn.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">
                      {inn.batting_team_id === team1.id ? team1.team_name : team2.team_name}
                    </span>
                    <Badge variant={inn.is_completed ? 'secondary' : 'default'}>
                      {inn.is_completed ? 'Completed' : 'In Progress'}
                    </Badge>
                  </div>
                  <p className="text-3xl font-bold">{inn.total_runs}/{inn.total_wickets}</p>
                  <p className="text-sm text-muted-foreground">({inn.total_overs} overs)</p>
                </div>
              ))}

              {/* Partnerships Section */}
              {partnerships.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    🤝 Partnerships
                  </h4>
                  <div className="space-y-2">
                    {partnerships.map((p, idx) => (
                      <div 
                        key={idx} 
                        className={`flex justify-between items-center p-2 rounded ${p.isActive ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50'}`}
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {getPlayerName(p.batsman1Id)} & {getPlayerName(p.batsman2Id)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {p.balls} balls • RR: {p.balls > 0 ? ((p.runs / p.balls) * 6).toFixed(2) : '0.00'}
                            {p.wicketFellAt && ` • FOW: ${p.wicketFellAt}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-lg font-bold ${p.isActive ? 'text-primary' : ''}`}>
                            {p.runs}
                          </span>
                          {p.isActive && (
                            <Badge variant="outline" className="ml-2 text-xs">Active</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground">No innings data</p>
          )}
        </TabsContent>

        <TabsContent value="balls" className="p-4 overflow-auto">
          <div className="space-y-2">
            {balls.length > 0 ? (
              balls.slice().reverse().map((ball, i) => (
                <div key={ball.id} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                  <span className="text-sm">
                    {ball.over_number}.{ball.ball_number} - {getPlayerName(ball.batsman_id)}
                  </span>
                  <Badge variant={ball.is_wicket ? 'destructive' : 'secondary'}>
                    {getBallDisplay(ball)}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground">No balls recorded</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="info" className="p-4">
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Format</Label>
              <p className="font-medium">{match.format} • {match.overs_per_innings} overs</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Teams</Label>
              <p className="font-medium">{team1.team_name} vs {team2.team_name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Status</Label>
              <Badge className="ml-2">{match.status}</Badge>
            </div>

            {/* Simple Scoring Mode */}
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-3">Quick Score Entry</h4>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <Label className="text-xs">Runs</Label>
                  <Input type="number" value={team1Score.runs} onChange={(e) => setTeam1Score({ ...team1Score, runs: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">Wickets</Label>
                  <Input type="number" min={0} max={10} value={team1Score.wickets} onChange={(e) => setTeam1Score({ ...team1Score, wickets: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">Overs</Label>
                  <Input type="number" step="0.1" value={team1Score.overs} onChange={(e) => setTeam1Score({ ...team1Score, overs: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <p className="text-sm font-medium mb-2">{team2.team_name}</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <Label className="text-xs">Runs</Label>
                  <Input type="number" value={team2Score.runs} onChange={(e) => setTeam2Score({ ...team2Score, runs: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">Wickets</Label>
                  <Input type="number" min={0} max={10} value={team2Score.wickets} onChange={(e) => setTeam2Score({ ...team2Score, wickets: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">Overs</Label>
                  <Input type="number" step="0.1" value={team2Score.overs} onChange={(e) => setTeam2Score({ ...team2Score, overs: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Winner</Label>
                <Select value={winnerId} onValueChange={setWinnerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select winner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={team1.id}>{team1.team_name}</SelectItem>
                    <SelectItem value={team2.id}>{team2.team_name}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 mt-4">
                <Button onClick={saveSimpleScore} variant="outline" className="flex-1">Save</Button>
                <Button onClick={completeMatch} className="flex-1">Complete</Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
