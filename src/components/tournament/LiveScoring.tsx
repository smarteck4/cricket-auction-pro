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
import { ArrowLeft, RotateCcw, AlertCircle, ArrowLeftRight } from 'lucide-react';
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
  
  // International standard features
  const [isFreeHit, setIsFreeHit] = useState(false);
  const [extraMode, setExtraMode] = useState<'wide' | 'no_ball' | 'bye' | 'leg_bye' | null>(null);

  // Player selection modal state
  type SelectionMode = 'opening' | 'new_batsman' | 'new_bowler' | 'new_batsman_and_bowler' | null;
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
    
    const displayOver = currentBall === 0 && currentOver > 0 ? currentOver - 1 : currentOver;
    
    let legal = 0;
    const overBalls: MatchBall[] = [];
    
    for (const ball of balls) {
      const isLegal = !ball.extra_type || !['wide', 'no_ball'].includes(ball.extra_type);
      const ballOverBefore = legal > 0 ? Math.floor((legal - 1) / 6) : 0;
      if (isLegal) legal++;
      const ballOver = legal > 0 ? Math.floor((legal - 1) / 6) : 0;
      
      const belongsToOver = isLegal ? ballOver === displayOver : ballOverBefore === displayOver;
      if (belongsToOver) {
        overBalls.push(ball);
      }
    }
    return overBalls;
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
        const isBallFaced = ball.extra_type !== 'wide';
        const isBatsmanRun = !ball.extra_type || ball.extra_type === 'no_ball';
        const runs = isBatsmanRun ? ball.runs_scored : 0;
        
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

  // Calculate bowler stats from balls with proper maiden calculation
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
    const bowlerOversRuns = new Map<string, Map<number, number>>();
    const bowlerOverBalls = new Map<string, Map<number, number>>();
    
    balls.forEach(ball => {
      if (ball.bowler_id) {
        const existing = statsMap.get(ball.bowler_id) || { overs: 0, maidens: 0, runs: 0, wickets: 0, economy: 0, legalBalls: 0 };
        const isLegal = !ball.extra_type || !['wide', 'no_ball'].includes(ball.extra_type);
        
        // Bowler charged for: bat runs, wide extras, NB extras (not byes/LBs)
        const isBowlerCharged = !ball.extra_type || ball.extra_type === 'wide' || ball.extra_type === 'no_ball';
        const runsConceded = isBowlerCharged ? (ball.runs_scored + ball.extras) : 0;
        existing.runs += runsConceded;
        
        if (isLegal) {
          existing.legalBalls++;
        }
        
        const completedOvers = Math.floor(existing.legalBalls / 6);
        const remainingBalls = existing.legalBalls % 6;
        existing.overs = completedOvers + (remainingBalls / 10);
        
        if (ball.is_wicket && ['bowled', 'caught', 'lbw', 'stumped', 'hit_wicket'].includes(ball.wicket_type || '')) {
          existing.wickets++;
        }
        
        // Track runs and balls per over for maiden calculation
        if (!bowlerOversRuns.has(ball.bowler_id)) bowlerOversRuns.set(ball.bowler_id, new Map());
        const overMap = bowlerOversRuns.get(ball.bowler_id)!;
        overMap.set(ball.over_number, (overMap.get(ball.over_number) || 0) + runsConceded);
        
        if (!bowlerOverBalls.has(ball.bowler_id)) bowlerOverBalls.set(ball.bowler_id, new Map());
        if (isLegal) {
          const ballMap = bowlerOverBalls.get(ball.bowler_id)!;
          ballMap.set(ball.over_number, (ballMap.get(ball.over_number) || 0) + 1);
        }
        
        existing.economy = existing.legalBalls > 0 ? (existing.runs / (existing.legalBalls / 6)) : 0;
        statsMap.set(ball.bowler_id, existing);
      }
    });
    
    // Calculate maiden overs (complete overs with 0 runs conceded)
    bowlerOversRuns.forEach((overMap, bowlerId) => {
      const stats = statsMap.get(bowlerId);
      const ballsMap = bowlerOverBalls.get(bowlerId);
      if (stats && ballsMap) {
        let maidenCount = 0;
        overMap.forEach((runs, overNum) => {
          const ballsInOver = ballsMap.get(overNum) || 0;
          if (runs === 0 && ballsInOver >= 6) maidenCount++;
        });
        stats.maidens = maidenCount;
        statsMap.set(bowlerId, stats);
      }
    });
    
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
      
      if (!currentPartnership && ball.batsman_id) {
        const nextBall = balls[index + 1];
        const prevBall = balls[index - 1];
        let partnerId = '';
        
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
      
      if (currentPartnership) {
        currentPartnership.runs += runsThisBall;
        if (isLegal) currentPartnership.balls++;
        
        if (ball.is_wicket) {
          runningTotal += currentPartnership.runs;
          currentPartnership.isActive = false;
          currentPartnership.wicketFellAt = runningTotal;
          partnershipList.push({ ...currentPartnership });
          currentPartnership = null;
        }
      }
    });
    
    if (currentPartnership) {
      partnershipList.push(currentPartnership);
    }
    
    return partnershipList;
  }, [balls]);

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

  const needsPlayerSelection = useMemo(() => {
    if (!currentInnings) return false;
    if (!strikerBatsman || !nonStrikerBatsman || !currentBowler) {
      return true;
    }
    return false;
  }, [currentInnings, strikerBatsman, nonStrikerBatsman, currentBowler]);

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

  const fetchInnings = async (skipReconstruct = false) => {
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
        if (skipReconstruct) {
          // Only refresh balls data without reconstructing player state
          const { data: ballsData } = await supabase
            .from('match_balls')
            .select('*')
            .eq('innings_id', active.id)
            .order('created_at');
          if (ballsData) setBalls(ballsData as MatchBall[]);
        } else {
          fetchBalls(active.id);
        }
      }

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

    const allBatsmen: string[] = [];
    const dismissed: string[] = [];
    for (const ball of ballsData) {
      if (ball.batsman_id && !allBatsmen.includes(ball.batsman_id)) {
        allBatsmen.push(ball.batsman_id);
      }
      if (ball.is_wicket && ball.batsman_id) {
        dismissed.push(ball.batsman_id);
      }
    }
    setDismissedBatsmen(dismissed);

    let striker = allBatsmen[0] || '';
    // If non-striker never faced a ball, preserve current state if available and not dismissed
    let nonStriker = allBatsmen[1] || '';
    if (!nonStriker && nonStrikerBatsman && !dismissed.includes(nonStrikerBatsman)) {
      nonStriker = nonStrikerBatsman;
    }
    // Also try preserving from striker state if only one batsman seen
    if (!nonStriker && strikerBatsman && strikerBatsman !== striker && !dismissed.includes(strikerBatsman) && allBatsmen.length === 1) {
      nonStriker = strikerBatsman;
    }
    let legalCount = 0;
    let nextBatsmanIdx = 2;

    for (const ball of ballsData) {
      const isWide = ball.extra_type === 'wide';
      const isNoBall = ball.extra_type === 'no_ball';
      const isBye = ball.extra_type === 'bye' || ball.extra_type === 'leg_bye';
      const isLegal = !isWide && !isNoBall;

      // Strike rotation: wide uses extras-1 (additional runs), bye/LB uses extras, normal/NB uses runs_scored
      let rotationRuns = 0;
      if (isWide) {
        rotationRuns = ball.extras > 1 ? ball.extras - 1 : 0; // additional runs beyond the 1 penalty
      } else if (isBye) {
        rotationRuns = ball.extras;
      } else {
        rotationRuns = ball.runs_scored;
      }

      if (rotationRuns % 2 === 1) {
        [striker, nonStriker] = [nonStriker, striker];
      }

      if (ball.is_wicket && ball.batsman_id) {
        const dismissedId = ball.batsman_id;
        const replacement = nextBatsmanIdx < allBatsmen.length ? allBatsmen[nextBatsmanIdx] : '';
        nextBatsmanIdx++;

        if (dismissedId === striker) {
          striker = replacement;
        } else if (dismissedId === nonStriker) {
          nonStriker = replacement;
        }
      }

      if (isLegal) {
        legalCount++;
        if (legalCount % 6 === 0) {
          [striker, nonStriker] = [nonStriker, striker];
        }
      }
    }

    setStrikerBatsman(striker);
    setNonStrikerBatsman(nonStriker);

    const lastBall = ballsData[ballsData.length - 1];
    const currentBowlerId = lastBall?.bowler_id || '';

    let prevOverBowler = '';
    if (legalCount > 0) {
      const currentOverNum = Math.floor((legalCount - 1) / 6);
      let tmpLegal = 0;
      for (const ball of ballsData) {
        const isLegal = !ball.extra_type || !['wide', 'no_ball'].includes(ball.extra_type);
        if (isLegal) tmpLegal++;
        const overOfBall = Math.floor((tmpLegal - 1) / 6);
        if (overOfBall === currentOverNum - 1 && ball.bowler_id) {
          prevOverBowler = ball.bowler_id;
        }
      }
    }

    const atOverEnd = legalCount > 0 && legalCount % 6 === 0;
    const lastBallWasWicket = ballsData[ballsData.length - 1]?.is_wicket || false;
    const hasUnreplacedWicket = lastBallWasWicket && !striker;

    if (atOverEnd && hasUnreplacedWicket) {
      setPreviousOverBowler(currentBowlerId);
      setCurrentBowler('');
      setSelectionMode('new_batsman_and_bowler');
      setPendingStriker('');
      setPendingBowler('');
    } else if (atOverEnd) {
      setPreviousOverBowler(currentBowlerId);
      setCurrentBowler('');
      setSelectionMode('new_bowler');
      setPendingBowler('');
    } else if (hasUnreplacedWicket) {
      setPreviousOverBowler(prevOverBowler);
      setCurrentBowler(currentBowlerId);
      setSelectionMode('new_batsman');
      setPendingStriker('');
    } else {
      // Mid-over, no pending wicket - resume normally without any selection prompt
      setPreviousOverBowler(prevOverBowler);
      setCurrentBowler(currentBowlerId);
      setSelectionMode(null);
    }

    // Reconstruct free hit state from ball history
    let freeHitActive = false;
    for (let i = ballsData.length - 1; i >= 0; i--) {
      if (ballsData[i].extra_type === 'no_ball') { freeHitActive = true; break; }
      if (ballsData[i].extra_type !== 'wide') break;
    }
    setIsFreeHit(freeHitActive);
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
    
    const overNum = Math.floor(newLegalDeliveries / 6);
    const ballNum = isLegalDelivery ? ((legalDeliveries % 6) + 1) : (legalDeliveries % 6);

    // International standard extras calculation
    // Wide: all runs are extras (1 penalty + additional runs batsmen ran)
    // No Ball: 1 penalty (extra), bat runs go to runs_scored
    // Bye/Leg Bye: all runs are extras, runs_scored = 0
    const runsOnBat = (extraTypeVal === 'wide' || extraTypeVal === 'bye' || extraTypeVal === 'leg_bye') ? 0 : runs;
    const extraRuns = (() => {
      if (!isExtra) return 0;
      if (extraTypeVal === 'wide') return 1 + runs;
      if (extraTypeVal === 'no_ball') return 1;
      if (extraTypeVal === 'bye' || extraTypeVal === 'leg_bye') return Math.max(runs, 1);
      return 1;
    })();

    const { error } = await supabase.from('match_balls').insert({
      innings_id: currentInnings.id,
      over_number: currentOver,
      ball_number: ballNum,
      batsman_id: strikerBatsman,
      bowler_id: currentBowler,
      runs_scored: runsOnBat,
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

    const newTotalRuns = currentInnings.total_runs + runsOnBat + extraRuns;
    const newTotalWickets = currentInnings.total_wickets + (isWicket ? 1 : 0);
    const newTotalOvers = isLegalDelivery 
      ? (ballNum === 6 ? Math.floor(newLegalDeliveries / 6) : Math.floor((newLegalDeliveries - 1) / 6) + (ballNum / 10))
      : currentInnings.total_overs;

    const newExtras = currentInnings.extras + extraRuns;

    await supabase
      .from('match_innings')
      .update({
        total_runs: newTotalRuns,
        total_wickets: newTotalWickets,
        total_overs: newTotalOvers,
        extras: newExtras,
      })
      .eq('id', currentInnings.id);

    // Check for automatic innings end conditions
    const maxOvers = match.overs_per_innings;
    const maxWickets = Math.min(10, battingTeamPlayers.length - 1);
    const allOversCompleted = isLegalDelivery && newLegalDeliveries >= maxOvers * 6;
    const allOut = newTotalWickets >= maxWickets;

    const firstInnings = innings.find(i => i.innings_number === 1);
    const isSecondInnings = currentInnings.innings_number === 2;
    const targetRuns = firstInnings ? firstInnings.total_runs + 1 : 0;
    const targetChased = isSecondInnings && newTotalRuns >= targetRuns;

    if (targetChased) {
      await supabase.from('match_innings').update({ is_completed: true }).eq('id', currentInnings.id);
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

    if (allOversCompleted || allOut) {
      await supabase.from('match_innings').update({ is_completed: true }).eq('id', currentInnings.id);

      if (isSecondInnings) {
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
        const reason = allOut ? 'All out' : 'Overs completed';
        toast({ 
          title: `1st Innings Completed`, 
          description: `${reason}. Starting 2nd innings...` 
        });
        
        setStrikerBatsman('');
        setNonStrikerBatsman('');
        setCurrentBowler('');
        setDismissedBatsmen([]);
        setRetiredHurtBatsmen([]);
        setPreviousOverBowler('');
        setMilestoneShown({});
        setIsFreeHit(false);
        
        await startInnings(currentInnings.bowling_team_id, currentInnings.batting_team_id);
        return;
      }
    }

    // Strike rotation based on runs parameter
    // Wide: runs = additional runs batsmen physically ran
    // NB: runs = bat runs
    // Bye/LB: runs = physical runs taken
    const rotationRuns = runs;

    const isOverEnd = isLegalDelivery && ballNum === 6;
    const isWicketActive = isWicket && newTotalWickets < maxWickets;

    let currentStriker = strikerBatsman;
    let currentNonStriker = nonStrikerBatsman;
    if (rotationRuns % 2 === 1) {
      [currentStriker, currentNonStriker] = [currentNonStriker, currentStriker];
    }

    if (isWicketActive && isOverEnd) {
      setDismissedBatsmen(prev => [...prev, strikerBatsman]);
      setStrikerBatsman(nonStrikerBatsman);
      setNonStrikerBatsman('');
      setPreviousOverBowler(currentBowler);
      setCurrentBowler('');
      setIsWicket(false);
      setWicketType('');
      setSelectedFielder('');
      setSelectionMode('new_batsman_and_bowler');
      setPendingStriker('');
      setPendingBowler('');
      toast({ title: 'Wicket + Over Complete', description: 'Select new batsman and bowler.' });
    } else if (isWicketActive && !isOverEnd) {
      setDismissedBatsmen(prev => [...prev, strikerBatsman]);
      if (rotationRuns % 2 === 1) {
        setStrikerBatsman(currentStriker);
        setNonStrikerBatsman('');
      } else {
        setStrikerBatsman('');
        setNonStrikerBatsman(currentNonStriker);
      }
      setIsWicket(false);
      setWicketType('');
      setSelectedFielder('');
      setSelectionMode('new_batsman');
      setPendingStriker('');
    } else if (isOverEnd) {
      setStrikerBatsman(currentNonStriker);
      setNonStrikerBatsman(currentStriker);
      setPreviousOverBowler(currentBowler);
      setCurrentBowler('');
      setSelectionMode('new_bowler');
      setPendingBowler('');
      toast({ title: 'Over Complete', description: `Over ${currentOver + 1} completed. Please select a new bowler.` });
    } else {
      setStrikerBatsman(currentStriker);
      setNonStrikerBatsman(currentNonStriker);
      
      if (isWicket) {
        setIsWicket(false);
        setWicketType('');
        setSelectedFielder('');
      }
    }

    // Milestone notifications
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

    // Free hit tracking: next legal delivery after a no-ball is a free hit
    if (extraTypeVal === 'no_ball') {
      setIsFreeHit(true);
    } else if (isLegalDelivery) {
      setIsFreeHit(false);
    }
    // Wide doesn't affect free hit status

    setExtraMode(null);
    fetchInnings(true);
  };

  const handleRetiredHurt = () => {
    if (!strikerBatsman) return;
    setRetiredHurtBatsmen(prev => [...prev, strikerBatsman]);
    setStrikerBatsman('');
    
    setSelectionMode('new_batsman');
    setPendingStriker('');
    
    toast({ title: 'Retired Hurt', description: 'Batsman marked as retired hurt. Select new batsman.' });
  };

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
      // Set the new batsman in whichever position is empty
      if (!strikerBatsman) {
        setStrikerBatsman(pendingStriker);
      } else {
        setNonStrikerBatsman(pendingStriker);
      }
    } else if (selectionMode === 'new_bowler') {
      if (!pendingBowler) {
        toast({ title: 'Select Bowler', description: 'Please select the new bowler.', variant: 'destructive' });
        return;
      }
      setCurrentBowler(pendingBowler);
    } else if (selectionMode === 'new_batsman_and_bowler') {
      if (!pendingStriker || !pendingBowler) {
        toast({ title: 'Select Players', description: 'Please select new batsman and bowler.', variant: 'destructive' });
        return;
      }
      setNonStrikerBatsman(pendingStriker);
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
    const extrasToRemove = lastBall.extras;
    const isLegal = !lastBall.extra_type || !['wide', 'no_ball'].includes(lastBall.extra_type);
    
    // Recalculate overs from remaining balls
    const remainingBalls = balls.slice(0, -1);
    let legalCount = 0;
    remainingBalls.forEach(b => {
      if (!b.extra_type || !['wide', 'no_ball'].includes(b.extra_type)) legalCount++;
    });
    const newOvers = Math.floor(legalCount / 6) + (legalCount % 6) / 10;
    
    await supabase
      .from('match_innings')
      .update({
        total_runs: currentInnings.total_runs - runsToRemove,
        total_wickets: currentInnings.total_wickets - wicketsToRemove,
        total_overs: newOvers,
        extras: currentInnings.extras - extrasToRemove,
      })
      .eq('id', currentInnings.id);

    // If a wicket was undone, remove the batsman from dismissed list
    if (lastBall.is_wicket && lastBall.batsman_id) {
      setDismissedBatsmen(prev => prev.filter(id => id !== lastBall.batsman_id));
    }

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
    if (ball.is_wicket) {
      const totalRuns = ball.runs_scored + ball.extras;
      if (ball.extra_type === 'wide') return totalRuns > 0 ? `W+${totalRuns}Wd` : 'W';
      if (ball.extra_type === 'no_ball') return totalRuns > 0 ? `W+${totalRuns}Nb` : 'W';
      return totalRuns > 0 ? `W+${totalRuns}` : 'W';
    }
    if (ball.extra_type === 'wide') return ball.extras > 1 ? `${ball.extras}Wd` : 'Wd';
    if (ball.extra_type === 'no_ball') return ball.runs_scored > 0 ? `${ball.runs_scored}+${ball.extras}Nb` : `${ball.extras}Nb`;
    if (ball.extra_type === 'bye') return `${ball.extras}B`;
    if (ball.extra_type === 'leg_bye') return `${ball.extras}Lb`;
    return ball.runs_scored.toString();
  };

  const getPlayerName = (id: string | null) => {
    if (!id) return 'Unknown';
    const player = [...battingTeamPlayers, ...bowlingTeamPlayers].find(p => p.id === id);
    return player?.name || 'Unknown';
  };

  // Scorecard helper: get all player names across both teams
  const getAllPlayerName = (id: string | null) => {
    if (!id) return 'Unknown';
    const player = [...team1Players, ...team2Players].find(p => p.id === id);
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
    <div className="flex flex-col h-full min-h-0 max-h-[85vh] rounded-xl overflow-hidden border border-border/50 shadow-2xl shadow-primary/5 bg-card">
      {/* Premium Header */}
      <div className="relative bg-gradient-to-r from-[hsl(var(--slate-dark))] via-[hsl(var(--slate))] to-[hsl(var(--slate-dark))] text-white px-4 py-3">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMGg2MHY2MEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjMwIiBjeT0iMzAiIHI9IjEuNSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNnKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] opacity-40" />
        <div className="relative flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/10 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm sm:text-base tracking-wide">MATCH CENTRE</h2>
              <p className="text-[10px] sm:text-xs text-white/60 font-medium">{match.format} • {match.overs_per_innings} overs</p>
            </div>
            <div className="flex items-center gap-2">
              {isFreeHit && (
                <Badge className="bg-red-500 text-white animate-pulse border-0 shadow-lg shadow-red-500/30 text-xs">FREE HIT</Badge>
              )}
              <Badge variant="outline" className="border-white/20 text-white/80 text-[10px]">{match.status.toUpperCase()}</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
        <div className="bg-[hsl(var(--slate-dark))] border-b border-white/10">
          <TabsList className="grid grid-cols-5 bg-transparent rounded-none gap-0 p-0 h-auto">
            {[
              { value: 'summary', label: 'Summary' },
              { value: 'scoring', label: 'Scoring' },
              { value: 'scorecard', label: 'Scorecard' },
              { value: 'balls', label: 'Balls' },
              { value: 'info', label: 'Info' },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="text-white/50 rounded-none border-b-2 border-transparent py-2.5 text-xs sm:text-sm font-medium transition-all data-[state=active]:text-primary data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent hover:text-white/70"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="summary" className="flex-1 min-h-0 overflow-auto p-0 m-0">
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

        <TabsContent value="scoring" className="flex-1 min-h-0 flex flex-col overflow-auto p-0 m-0">
          {currentInnings ? (
            <div className="flex flex-col flex-1 min-h-0 relative">
              {/* Premium Score Display */}
              <div className="relative bg-gradient-to-br from-card via-card to-primary/5 p-5 text-center border-b border-border/50">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="text-xs font-bold tracking-[0.15em] uppercase text-primary">{battingTeam.team_name}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">INN {currentInnings.innings_number}</span>
                </div>
                <div className="flex items-baseline justify-center gap-1 my-3">
                  <span className="text-6xl sm:text-7xl font-black tracking-tight bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {currentInnings.total_runs}
                  </span>
                  <span className="text-2xl sm:text-3xl font-bold text-muted-foreground/60">-</span>
                  <span className="text-3xl sm:text-4xl font-bold text-destructive/80">{currentInnings.total_wickets}</span>
                </div>
                <div className="flex justify-center gap-1 flex-wrap">
                  <span className="text-xs bg-muted/60 text-muted-foreground px-2.5 py-1 rounded-full font-medium">
                    Ov {currentOver}.{currentBall}/{match.overs_per_innings}
                  </span>
                  <span className="text-xs bg-muted/60 text-muted-foreground px-2.5 py-1 rounded-full font-medium">
                    CRR {currentRR.toFixed(2)}
                  </span>
                  <span className="text-xs bg-muted/60 text-muted-foreground px-2.5 py-1 rounded-full font-medium">
                    Ext {currentInnings.extras}
                  </span>
                </div>
                {target > 0 && (
                  <div className="mt-3 inline-flex flex-col items-center bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-lg px-4 py-2 border border-primary/15">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">Target <span className="font-bold text-foreground">{target}</span></span>
                      <span className="w-px h-3 bg-border" />
                      <span className="text-muted-foreground">Need <span className="font-bold text-primary">{target - currentInnings.total_runs}</span> off <span className="font-semibold">{(match.overs_per_innings * 6) - legalDeliveries}</span></span>
                      <span className="w-px h-3 bg-border" />
                      <span className="text-muted-foreground">RRR <span className="font-bold text-destructive">{reqRR.toFixed(2)}</span></span>
                    </div>
                  </div>
                )}
                {isFreeHit && (
                  <div className="mt-3">
                    <Badge className="bg-red-500/90 text-white animate-pulse text-sm px-5 py-1.5 shadow-lg shadow-red-500/20 border-0">🔴 FREE HIT</Badge>
                  </div>
                )}
              </div>

              {/* Player Selection Modal Overlay */}
              {selectionMode && (
                <div className="absolute inset-0 z-50 bg-background/98 backdrop-blur-md flex flex-col overflow-hidden">
                  <div className="bg-gradient-to-r from-[hsl(var(--slate-dark))] to-[hsl(var(--slate))] px-5 py-4">
                    <h3 className="text-lg font-bold text-white text-center tracking-wide">
                      {selectionMode === 'opening' && '🏏 Select Opening Players'}
                      {selectionMode === 'new_batsman' && '🏏 Select New Batsman'}
                      {selectionMode === 'new_bowler' && '🏐 Select New Bowler'}
                      {selectionMode === 'new_batsman_and_bowler' && '🏏 Select New Batsman & Bowler'}
                    </h3>
                    <p className="text-white/50 text-xs text-center mt-1">Choose players to continue the match</p>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-5 space-y-5">
                    {(selectionMode === 'opening' || selectionMode === 'new_batsman' || selectionMode === 'new_batsman_and_bowler') && (
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-primary">
                          {selectionMode === 'opening' ? '⚡ Striker' : '🏏 New Batsman'}
                        </Label>
                        <Select value={pendingStriker} onValueChange={setPendingStriker}>
                          <SelectTrigger className="w-full h-12 text-base border-primary/20 focus:ring-primary/30">
                            <SelectValue placeholder="Select batsman..." />
                          </SelectTrigger>
                          <SelectContent className="bg-background border shadow-xl z-[60]">
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
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-muted-foreground">🛡️ Non-Striker</Label>
                        <Select value={pendingNonStriker} onValueChange={setPendingNonStriker}>
                          <SelectTrigger className="w-full h-12 text-base">
                            <SelectValue placeholder="Select batsman..." />
                          </SelectTrigger>
                          <SelectContent className="bg-background border shadow-xl z-[60]">
                            {availableBatsmen.filter(p => p.id !== pendingStriker).map((p) => (
                              <SelectItem key={p.id} value={p.id} className="py-3">
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {(selectionMode === 'opening' || selectionMode === 'new_bowler' || selectionMode === 'new_batsman_and_bowler') && (
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-destructive/80">
                          {selectionMode === 'opening' ? '🏐 Opening Bowler' : '🏐 New Bowler'}
                        </Label>
                        {selectionMode === 'new_bowler' && previousOverBowler && (
                          <p className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                            ⚠️ {bowlingTeamPlayers.find(p => p.id === previousOverBowler)?.name} bowled the previous over
                          </p>
                        )}
                        <Select value={pendingBowler} onValueChange={setPendingBowler}>
                          <SelectTrigger className="w-full h-12 text-base">
                            <SelectValue placeholder="Select bowler..." />
                          </SelectTrigger>
                          <SelectContent className="bg-background border shadow-xl z-[60]">
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
                  
                  <div className="p-4 border-t bg-card shrink-0">
                    <Button onClick={confirmPlayerSelection} className="w-full h-12 text-base font-bold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20">
                      ✓ Confirm Selection
                    </Button>
                  </div>
                </div>
              )}

              {/* Premium Batsmen & Bowler Stats */}
              <div className="bg-card/80 backdrop-blur-sm px-3 py-2.5 border-b border-border/50">
                {/* Batsman Header */}
                <div className="text-[10px] text-muted-foreground/60 font-bold tracking-[0.1em] uppercase mb-1.5 flex justify-between">
                  <span>Batsman</span>
                  <div className="flex gap-4 text-center">
                    <span className="w-7">R</span>
                    <span className="w-7">B</span>
                    <span className="w-7">4s</span>
                    <span className="w-7">6s</span>
                    <span className="w-10">SR</span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  {/* Striker */}
                  <div className="flex justify-between items-center bg-primary/5 rounded-md px-2 py-1.5 border border-primary/10">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                      <span className="text-sm font-semibold truncate max-w-[120px] sm:max-w-[160px]">
                        {strikerBatsman ? getPlayerName(strikerBatsman) : <span className="text-muted-foreground italic text-xs">Striker</span>}
                      </span>
                      <span className="text-[9px] text-primary/60 font-medium">*</span>
                    </div>
                    {strikerBatsman ? (
                      <div className="flex gap-4 text-sm text-center tabular-nums">
                        <span className="w-7 font-bold text-foreground">{getBatsmanStats(strikerBatsman).runs}</span>
                        <span className="w-7 text-muted-foreground">{getBatsmanStats(strikerBatsman).balls}</span>
                        <span className="w-7 text-primary">{getBatsmanStats(strikerBatsman).fours}</span>
                        <span className="w-7 text-accent-foreground">{getBatsmanStats(strikerBatsman).sixes}</span>
                        <span className="w-10 text-muted-foreground text-xs">{getBatsmanStats(strikerBatsman).strikeRate.toFixed(0)}</span>
                      </div>
                    ) : (
                      <div className="flex gap-4 text-sm text-center text-muted-foreground/40">
                        <span className="w-7">-</span><span className="w-7">-</span><span className="w-7">-</span><span className="w-7">-</span><span className="w-10">-</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Non-Striker */}
                  <div className="flex justify-between items-center px-2 py-1.5 rounded-md">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-muted-foreground/30 rounded-full" />
                      <span className="text-sm truncate max-w-[120px] sm:max-w-[160px] text-muted-foreground">
                        {nonStrikerBatsman ? getPlayerName(nonStrikerBatsman) : <span className="italic text-xs">Non-Striker</span>}
                      </span>
                    </div>
                    {nonStrikerBatsman ? (
                      <div className="flex gap-4 text-sm text-center tabular-nums text-muted-foreground">
                        <span className="w-7 font-medium text-foreground/80">{getBatsmanStats(nonStrikerBatsman).runs}</span>
                        <span className="w-7">{getBatsmanStats(nonStrikerBatsman).balls}</span>
                        <span className="w-7">{getBatsmanStats(nonStrikerBatsman).fours}</span>
                        <span className="w-7">{getBatsmanStats(nonStrikerBatsman).sixes}</span>
                        <span className="w-10 text-xs">{getBatsmanStats(nonStrikerBatsman).strikeRate.toFixed(0)}</span>
                      </div>
                    ) : (
                      <div className="flex gap-4 text-sm text-center text-muted-foreground/40">
                        <span className="w-7">-</span><span className="w-7">-</span><span className="w-7">-</span><span className="w-7">-</span><span className="w-10">-</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bowler Stats */}
                <div className="mt-2 pt-2 border-t border-border/30">
                  <div className="text-[10px] text-muted-foreground/60 font-bold tracking-[0.1em] uppercase mb-1 flex justify-between">
                    <span>Bowler</span>
                    <div className="flex gap-4 text-center">
                      <span className="w-7">O</span>
                      <span className="w-7">M</span>
                      <span className="w-7">R</span>
                      <span className="w-7">W</span>
                      <span className="w-10">Eco</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-destructive/50 rounded-full" />
                      <span className="text-sm font-medium truncate max-w-[140px] sm:max-w-[170px]">
                        {currentBowler ? getPlayerName(currentBowler) : <span className="text-muted-foreground italic text-xs">Bowler</span>}
                      </span>
                    </div>
                    {currentBowler ? (
                      <div className="flex gap-4 text-sm text-center tabular-nums">
                        <span className="w-7">{getBowlerStats(currentBowler).overs.toFixed(1)}</span>
                        <span className="w-7 text-muted-foreground">{getBowlerStats(currentBowler).maidens}</span>
                        <span className="w-7 text-destructive">{getBowlerStats(currentBowler).runs}</span>
                        <span className="w-7 font-bold text-primary">{getBowlerStats(currentBowler).wickets}</span>
                        <span className="w-10 text-muted-foreground text-xs">{getBowlerStats(currentBowler).economy.toFixed(1)}</span>
                      </div>
                    ) : (
                      <div className="flex gap-4 text-sm text-center text-muted-foreground/40">
                        <span className="w-7">-</span><span className="w-7">-</span><span className="w-7">-</span><span className="w-7">-</span><span className="w-10">-</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Current Partnership */}
                {currentPartnership && (strikerBatsman || nonStrikerBatsman) && (
                  <div className="mt-2 pt-2 border-t border-border/30">
                    <div className="flex items-center justify-between bg-primary/5 rounded-md px-2.5 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Partnership</span>
                        <span className="text-sm font-bold text-primary">{currentPartnership.runs}</span>
                        <span className="text-[10px] text-muted-foreground">({currentPartnership.balls}b)</span>
                      </div>
                      {currentPartnership.balls > 0 && (
                        <span className="text-[10px] text-muted-foreground font-medium">
                          RR {((currentPartnership.runs / currentPartnership.balls) * 6).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* This Over Display */}
              <div className="bg-muted/40 px-3 py-2 flex items-center gap-2 border-b border-border/30">
                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider shrink-0">Over {currentOver + 1}</span>
                <div className="flex gap-1.5 flex-wrap">
                  {currentOverBalls.map((ball, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold transition-all ${
                        ball.is_wicket 
                          ? 'bg-destructive text-white shadow-sm shadow-destructive/30' 
                          : ball.runs_scored >= 6 
                          ? 'bg-primary text-white shadow-sm shadow-primary/30'
                          : ball.runs_scored === 4
                          ? 'bg-primary/80 text-white shadow-sm'
                          : ball.extra_type 
                          ? 'bg-accent/30 text-accent-foreground border border-accent/40'
                          : 'bg-muted text-muted-foreground border border-border/50'
                      }`}
                    >
                      {getBallDisplay(ball)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Scoring Controls */}
              <div className="p-3 bg-card/50 flex-1">
                {extraMode ? (
                  /* ===== EXTRA MODE ===== */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge className={`text-sm font-bold border-0 px-3 py-1 ${
                        extraMode === 'wide' ? 'bg-blue-500/15 text-blue-600' : 
                        extraMode === 'no_ball' ? 'bg-red-500/15 text-red-600' :
                        extraMode === 'bye' ? 'bg-yellow-500/15 text-yellow-700' : 
                        'bg-green-500/15 text-green-700'
                      }`}>
                        {extraMode === 'wide' ? '🔵 Wide' : extraMode === 'no_ball' ? '🔴 No Ball' : extraMode === 'bye' ? '🟡 Bye' : '🟢 Leg Bye'}
                        {isWicket && ' + Wicket'}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => setExtraMode(null)} className="text-muted-foreground hover:text-foreground">✕ Cancel</Button>
                    </div>
                    <div className={`grid ${extraMode === 'no_ball' ? 'grid-cols-4' : 'grid-cols-5'} gap-2`}>
                      {(extraMode === 'wide' ? [0,1,2,3,4] : 
                        extraMode === 'no_ball' ? [0,1,2,3,4,5,6] : 
                        [1,2,3,4]).map((run) => (
                        <Button
                          key={run}
                          onClick={() => recordBall(run, true, extraMode)}
                          className={`h-14 text-base font-bold rounded-xl transition-all active:scale-95 ${
                            run === 4 || run === 6 
                              ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20' 
                              : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                          }`}
                        >
                          {extraMode === 'wide' ? (run === 0 ? 'Wd' : `Wd+${run}`) :
                           extraMode === 'no_ball' ? (run === 0 ? 'NB' : `${run}+NB`) :
                           extraMode === 'bye' ? `${run}B` :
                           `${run}Lb`}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      {extraMode === 'wide' ? 'Select additional runs on the wide delivery' :
                       extraMode === 'no_ball' ? 'Select runs scored off the bat on the no ball' :
                       'Select number of bye/leg bye runs taken'}
                    </p>
                  </div>
                ) : isWicket ? (
                  /* ===== WICKET MODE ===== */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-destructive/15 text-destructive border-0 text-sm font-bold px-3 py-1">⚠️ Wicket Mode</Badge>
                      <Button variant="ghost" size="sm" onClick={() => { setIsWicket(false); setWicketType(''); setSelectedFielder(''); }} className="text-muted-foreground">
                        ✕ Cancel
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      {(isFreeHit 
                        ? ['run_out'] 
                        : ['bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket']
                      ).map((wt) => (
                        <Button
                          key={wt}
                          size="sm"
                          variant={wicketType === wt ? 'destructive' : 'outline'}
                          onClick={() => setWicketType(wt)}
                          className={`text-xs rounded-lg h-10 font-semibold transition-all ${wicketType === wt ? 'shadow-md shadow-destructive/20' : ''}`}
                        >
                          {wt.replace('_', ' ').toUpperCase()}
                        </Button>
                      ))}
                    </div>
                    
                    {isFreeHit && (
                      <p className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-lg border border-border/50">
                        ℹ️ Only run out is allowed on a free hit delivery
                      </p>
                    )}
                    
                    {['caught', 'run_out', 'stumped'].includes(wicketType) && (
                      <Select value={selectedFielder} onValueChange={setSelectedFielder}>
                        <SelectTrigger className="border-destructive/20">
                          <SelectValue placeholder={wicketType === 'caught' ? 'Select catcher' : 'Select fielder'} />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-xl z-50">
                          {wicketType === 'caught' && currentBowler && (
                            <SelectItem value={currentBowler} className="font-medium">
                              {getPlayerName(currentBowler)} (Caught & Bowled)
                            </SelectItem>
                          )}
                          {bowlingTeamPlayers.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    
                    <div className="space-y-2">
                      <Button onClick={() => recordBall(0)} className="w-full h-12 rounded-xl shadow-lg shadow-destructive/15" variant="destructive" disabled={!wicketType}>
                        Record Wicket (0 runs)
                      </Button>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[1,2,3,4].map(r => (
                          <Button key={r} size="sm" variant="outline" onClick={() => recordBall(r)} disabled={!wicketType} className="text-xs h-9 rounded-lg">
                            W+{r}
                          </Button>
                        ))}
                      </div>
                      {(wicketType === 'stumped' || wicketType === 'run_out') && (
                        <div className="flex gap-2 mt-1">
                          <Button size="sm" variant="outline" onClick={() => recordBall(0, true, 'wide')} disabled={!wicketType} className="text-xs flex-1 h-9 rounded-lg">
                            W on Wide
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => recordBall(0, true, 'no_ball')} disabled={!wicketType} className="text-xs flex-1 h-9 rounded-lg">
                            W on No Ball
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* ===== NORMAL SCORING MODE ===== */
                  <>
                    {/* Premium Run Buttons */}
                    <div className="grid grid-cols-7 gap-1.5 mb-3">
                      {[0, 1, 2, 3, 4, 5, 6].map((run) => (
                        <Button
                          key={run}
                          onClick={() => recordBall(run)}
                          className={`h-14 text-lg font-black rounded-xl transition-all active:scale-95 ${
                            run === 6 ? 'bg-gradient-to-b from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40' : 
                            run === 4 ? 'bg-gradient-to-b from-primary/90 to-primary/70 text-primary-foreground shadow-md shadow-primary/20' : 
                            run === 0 ? 'bg-muted/80 text-muted-foreground hover:bg-muted border border-border/50' : 
                            'bg-secondary/80 text-secondary-foreground hover:bg-secondary border border-border/30'
                          }`}
                        >
                          {run === 0 ? '•' : run}
                        </Button>
                      ))}
                    </div>

                    {/* Extras Row */}
                    <div className="grid grid-cols-4 gap-1.5 mb-3">
                      {[
                        { mode: 'wide' as const, label: 'Wide', color: 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30' },
                        { mode: 'no_ball' as const, label: 'No Ball', color: 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30' },
                        { mode: 'bye' as const, label: 'Bye', color: 'text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-950/30' },
                        { mode: 'leg_bye' as const, label: 'Leg Bye', color: 'text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30' },
                      ].map(({ mode, label, color }) => (
                        <Button key={mode} variant="outline" onClick={() => setExtraMode(mode)} className={`text-xs h-10 rounded-lg font-semibold border-border/50 ${color}`}>
                          {label}
                        </Button>
                      ))}
                    </div>

                    {/* Actions Row */}
                    <div className="grid grid-cols-4 gap-1.5 mb-3">
                      <Button variant="outline" onClick={undoLastBall} className="text-xs h-10 rounded-lg gap-1 border-border/50 font-medium" disabled={!balls.length}>
                        <RotateCcw className="h-3 w-3" /> Undo
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={() => setIsWicket(true)}
                        className="text-xs h-10 rounded-lg font-bold shadow-md shadow-destructive/15"
                      >
                        Wicket
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={handleRetiredHurt}
                        className="text-xs h-10 rounded-lg border-border/50 font-medium"
                        disabled={!strikerBatsman}
                      >
                        Retired
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setStrikerBatsman(nonStrikerBatsman);
                          setNonStrikerBatsman(strikerBatsman);
                        }}
                        className="text-xs h-10 rounded-lg gap-1 border-border/50 font-medium"
                        disabled={!strikerBatsman || !nonStrikerBatsman}
                      >
                        <ArrowLeftRight className="h-3 w-3" /> Swap
                      </Button>
                    </div>
                  </>
                )}

                {/* End Innings */}
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" onClick={endInnings} className="flex-1 rounded-lg border-border/50 font-medium">
                    End Innings
                  </Button>
                  {innings.length >= 2 && innings.every((i) => i.is_completed) && (
                    <Button onClick={completeMatch} className="flex-1 rounded-lg bg-gradient-to-r from-primary to-primary/80 font-bold shadow-lg shadow-primary/20">
                      Complete Match
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Start Innings */
            <div className="p-6 space-y-5">
              <div className="text-center">
                <h3 className="text-xl font-bold">Start Innings {innings.length + 1}</h3>
                <p className="text-sm text-muted-foreground mt-1">Select which team will bat first</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Button onClick={() => startInnings(team1.id, team2.id)} className="h-28 flex-col rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all">
                  <span className="text-lg font-bold">{team1.team_name}</span>
                  <span className="text-xs opacity-70 mt-1">Bats First</span>
                </Button>
                <Button onClick={() => startInnings(team2.id, team1.id)} className="h-28 flex-col rounded-xl border-2 border-border/50 hover:border-primary/30 transition-all" variant="outline">
                  <span className="text-lg font-bold">{team2.team_name}</span>
                  <span className="text-xs opacity-70 mt-1">Bats First</span>
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ===== PREMIUM SCORECARD ===== */}
        <TabsContent value="scorecard" className="flex-1 min-h-0 overflow-auto p-3 m-0">
          {innings.length > 0 ? (
            <div className="space-y-6">
              {innings.map((inn, innIdx) => {
                const innBalls = allInningsBalls[innIdx] || [];
                const isBattingTeam1 = inn.batting_team_id === team1.id;
                const batPlayers = isBattingTeam1 ? team1Players : team2Players;
                const bowlPlayers = isBattingTeam1 ? team2Players : team1Players;
                const batTeamName = isBattingTeam1 ? team1.team_name : team2.team_name;

                const batStats = new Map<string, { runs: number; balls: number; fours: number; sixes: number; isOut: boolean; howOut: string }>();
                const bowlStats = new Map<string, { legalBalls: number; runs: number; wickets: number; maidens: number }>();
                const bowlOverRuns = new Map<string, Map<number, number>>();
                const bowlOverBallCount = new Map<string, Map<number, number>>();
                const fow: { wicketNum: number; score: number; batsmanName: string; overs: string }[] = [];
                let totalRuns = 0;
                let totalWickets = 0;
                let legalBallCount = 0;
                const batsmanOrder: string[] = [];

                innBalls.forEach(ball => {
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
                      const oversDisplay = `${Math.floor(legalBallCount / 6)}.${legalBallCount % 6}`;
                      fow.push({
                        wicketNum: totalWickets,
                        score: totalRuns,
                        batsmanName: batPlayers.find(p => p.id === ball.batsman_id)?.name?.split(' ').pop() || '',
                        overs: oversDisplay,
                      });
                    }
                    batStats.set(ball.batsman_id, existing);
                  }

                  if (ball.bowler_id) {
                    const existing = bowlStats.get(ball.bowler_id) || { legalBalls: 0, runs: 0, wickets: 0, maidens: 0 };
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
                    if (!bowlOverBallCount.has(ball.bowler_id)) bowlOverBallCount.set(ball.bowler_id, new Map());
                    if (isLegal) {
                      bowlOverBallCount.get(ball.bowler_id)!.set(ball.over_number, (bowlOverBallCount.get(ball.bowler_id)!.get(ball.over_number) || 0) + 1);
                    }
                  }
                });

                bowlOverRuns.forEach((overMap, bowlerId) => {
                  const stats = bowlStats.get(bowlerId);
                  const ballsMap = bowlOverBallCount.get(bowlerId);
                  if (stats && ballsMap) {
                    let mc = 0;
                    overMap.forEach((runs, overNum) => {
                      if (runs === 0 && (ballsMap.get(overNum) || 0) >= 6) mc++;
                    });
                    stats.maidens = mc;
                  }
                });

                const oversDisplay = `${Math.floor(inn.total_overs)}.${Math.round((inn.total_overs % 1) * 10)}`;

                return (
                  <div key={inn.id} className="rounded-xl overflow-hidden border border-border/50 shadow-md">
                    {/* Innings Header */}
                    <div className="bg-gradient-to-r from-[hsl(var(--slate-dark))] to-[hsl(var(--slate))] px-4 py-2.5 flex justify-between items-center">
                      <span className="font-bold text-white text-sm tracking-wide">{batTeamName} — Innings {inn.innings_number}</span>
                      <span className="font-black text-white text-lg">{inn.total_runs}/{inn.total_wickets} <span className="text-white/60 text-xs font-medium">({oversDisplay} ov)</span></span>
                    </div>

                    {/* Batting Table */}
                    {innBalls.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="text-left p-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Batsman</th>
                              <th className="text-left p-2.5 font-medium text-xs max-w-[100px]"></th>
                              <th className="text-center p-2.5 font-semibold text-xs text-muted-foreground w-8">R</th>
                              <th className="text-center p-2.5 font-semibold text-xs text-muted-foreground w-8">B</th>
                              <th className="text-center p-2.5 font-semibold text-xs text-muted-foreground w-8">4s</th>
                              <th className="text-center p-2.5 font-semibold text-xs text-muted-foreground w-8">6s</th>
                              <th className="text-center p-2.5 font-semibold text-xs text-muted-foreground w-12">SR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {batsmanOrder.map((id) => {
                              const stats = batStats.get(id);
                              const player = batPlayers.find(p => p.id === id);
                              if (!stats || !player) return null;
                              return (
                                <tr key={id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                                  <td className="p-2.5 font-semibold text-xs sm:text-sm">{player.name}</td>
                                  <td className="p-2.5 text-xs text-muted-foreground max-w-[100px] truncate italic">{stats.howOut}</td>
                                  <td className="text-center p-2.5 font-black text-primary">{stats.runs}</td>
                                  <td className="text-center p-2.5 text-muted-foreground">{stats.balls}</td>
                                  <td className="text-center p-2.5">{stats.fours}</td>
                                  <td className="text-center p-2.5">{stats.sixes}</td>
                                  <td className="text-center p-2.5 text-muted-foreground text-xs">{stats.balls > 0 ? ((stats.runs / stats.balls) * 100).toFixed(1) : '0.0'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Extras & Total */}
                    <div className="border-t border-border/30 px-4 py-2.5 flex justify-between text-sm bg-muted/20">
                      <span className="text-muted-foreground">Extras: <span className="font-semibold text-foreground">{inn.extras}</span></span>
                      <span className="font-black">Total: {inn.total_runs}/{inn.total_wickets} ({oversDisplay} ov)</span>
                    </div>

                    {/* Fall of Wickets */}
                    {fow.length > 0 && (
                      <div className="border-t border-border/30 px-4 py-2.5 bg-muted/10">
                        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1">Fall of Wickets</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {fow.map((f, i) => (
                            <span key={i}>
                              {i > 0 && <span className="text-border mx-1">•</span>}
                              <span className="font-bold text-foreground">{f.wicketNum}-{f.score}</span>
                              {' '}({f.batsmanName}, {f.overs})
                            </span>
                          ))}
                        </p>
                      </div>
                    )}

                    {/* Bowling Table */}
                    {innBalls.length > 0 && (
                      <div className="border-t border-border/30 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="text-left p-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Bowler</th>
                              <th className="text-center p-2.5 font-semibold text-xs text-muted-foreground w-10">O</th>
                              <th className="text-center p-2.5 font-semibold text-xs text-muted-foreground w-8">M</th>
                              <th className="text-center p-2.5 font-semibold text-xs text-muted-foreground w-8">R</th>
                              <th className="text-center p-2.5 font-semibold text-xs text-muted-foreground w-8">W</th>
                              <th className="text-center p-2.5 font-semibold text-xs text-muted-foreground w-12">Eco</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from(bowlStats.entries()).map(([id, stats]) => {
                              const player = bowlPlayers.find(p => p.id === id);
                              if (!player) return null;
                              const overs = Math.floor(stats.legalBalls / 6) + (stats.legalBalls % 6) / 10;
                              return (
                                <tr key={id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                                  <td className="p-2.5 font-semibold text-xs sm:text-sm">{player.name}</td>
                                  <td className="text-center p-2.5">{overs.toFixed(1)}</td>
                                  <td className="text-center p-2.5 text-muted-foreground">{stats.maidens}</td>
                                  <td className="text-center p-2.5 text-destructive">{stats.runs}</td>
                                  <td className="text-center p-2.5 font-black text-primary">{stats.wickets}</td>
                                  <td className="text-center p-2.5 text-muted-foreground text-xs">{stats.legalBalls > 0 ? (stats.runs / (stats.legalBalls / 6)).toFixed(2) : '0.00'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Partnerships */}
              {partnerships.length > 0 && (
                <div className="rounded-xl border border-border/50 overflow-hidden shadow-sm">
                  <div className="bg-muted/30 px-4 py-2.5 border-b border-border/30">
                    <h4 className="font-bold text-sm tracking-wide">🤝 Partnerships</h4>
                  </div>
                  <div className="p-3 space-y-2">
                    {partnerships.map((p, idx) => (
                      <div 
                        key={idx} 
                        className={`flex justify-between items-center p-2.5 rounded-lg transition-colors ${
                          p.isActive ? 'bg-primary/8 border border-primary/20 shadow-sm' : 'bg-muted/30'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="text-sm font-semibold">
                            {getPlayerName(p.batsman1Id)} & {getPlayerName(p.batsman2Id)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {p.balls} balls • RR: {p.balls > 0 ? ((p.runs / p.balls) * 6).toFixed(2) : '0.00'}
                            {p.wicketFellAt && ` • FOW: ${p.wicketFellAt}`}
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <span className={`text-xl font-black ${p.isActive ? 'text-primary' : ''}`}>
                            {p.runs}
                          </span>
                          {p.isActive && (
                            <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">LIVE</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No innings data yet</p>
          )}
        </TabsContent>

        <TabsContent value="balls" className="flex-1 min-h-0 p-4 overflow-auto">
          <div className="space-y-1.5">
            {balls.length > 0 ? (
              balls.slice().reverse().map((ball, i) => (
                <div key={ball.id} className="flex justify-between items-center p-2.5 bg-muted/30 rounded-lg border border-border/30 hover:bg-muted/50 transition-colors">
                  <span className="text-sm font-medium">
                    <span className="text-muted-foreground text-xs mr-2">{ball.over_number}.{ball.ball_number}</span>
                    {getPlayerName(ball.batsman_id)}
                  </span>
                  <span
                    className={`inline-flex items-center justify-center min-w-[2rem] h-7 rounded-full text-xs font-bold px-2 ${
                      ball.is_wicket 
                        ? 'bg-destructive text-white' 
                        : ball.runs_scored >= 4 
                        ? 'bg-primary text-white'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {getBallDisplay(ball)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No balls recorded</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="info" className="p-5">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/30 rounded-xl p-4 border border-border/30">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Format</p>
                <p className="font-bold text-lg">{match.format}</p>
                <p className="text-xs text-muted-foreground">{match.overs_per_innings} overs</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 border border-border/30">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Status</p>
                <Badge className="mt-1">{match.status}</Badge>
              </div>
            </div>
            
            <div className="bg-muted/30 rounded-xl p-4 border border-border/30">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2">Teams</p>
              <div className="flex items-center justify-center gap-4">
                <span className="font-bold text-sm">{team1.team_name}</span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">VS</span>
                <span className="font-bold text-sm">{team2.team_name}</span>
              </div>
            </div>

            {/* Quick Score Entry */}
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <div className="bg-muted/30 px-4 py-2.5 border-b border-border/30">
                <h4 className="font-bold text-sm">Quick Score Entry</h4>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-sm font-bold mb-2 text-primary">{team1.team_name}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Runs</Label>
                      <Input type="number" value={team1Score.runs} onChange={(e) => setTeam1Score({ ...team1Score, runs: parseInt(e.target.value) || 0 })} className="rounded-lg" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Wickets</Label>
                      <Input type="number" min={0} max={10} value={team1Score.wickets} onChange={(e) => setTeam1Score({ ...team1Score, wickets: parseInt(e.target.value) || 0 })} className="rounded-lg" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Overs</Label>
                      <Input type="number" step="0.1" value={team1Score.overs} onChange={(e) => setTeam1Score({ ...team1Score, overs: parseFloat(e.target.value) || 0 })} className="rounded-lg" />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold mb-2 text-primary">{team2.team_name}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Runs</Label>
                      <Input type="number" value={team2Score.runs} onChange={(e) => setTeam2Score({ ...team2Score, runs: parseInt(e.target.value) || 0 })} className="rounded-lg" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Wickets</Label>
                      <Input type="number" min={0} max={10} value={team2Score.wickets} onChange={(e) => setTeam2Score({ ...team2Score, wickets: parseInt(e.target.value) || 0 })} className="rounded-lg" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Overs</Label>
                      <Input type="number" step="0.1" value={team2Score.overs} onChange={(e) => setTeam2Score({ ...team2Score, overs: parseFloat(e.target.value) || 0 })} className="rounded-lg" />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Winner</Label>
                  <Select value={winnerId} onValueChange={setWinnerId}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder="Select winner" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-xl">
                      <SelectItem value={team1.id}>{team1.team_name}</SelectItem>
                      <SelectItem value={team2.id}>{team2.team_name}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={saveSimpleScore} className="flex-1 rounded-lg font-semibold">Save Scores</Button>
                  <Button onClick={completeMatch} variant="outline" className="flex-1 rounded-lg font-semibold border-primary/30 text-primary hover:bg-primary/5">Complete Match</Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
