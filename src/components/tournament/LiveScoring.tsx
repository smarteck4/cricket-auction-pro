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
  const [currentInnings, setCurrentInnings] = useState<MatchInnings | null>(null);
  const [balls, setBalls] = useState<MatchBall[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('scoring');

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

  // Simple scoring state
  const [simpleMode, setSimpleMode] = useState(true);
  const [team1Score, setTeam1Score] = useState({ runs: 0, wickets: 0, overs: 0 });
  const [team2Score, setTeam2Score] = useState({ runs: 0, wickets: 0, overs: 0 });
  const [winnerId, setWinnerId] = useState('');

  const battingTeam = currentInnings?.batting_team_id === team1.id ? team1 : team2;
  const bowlingTeam = currentInnings?.bowling_team_id === team1.id ? team1 : team2;
  const battingTeamPlayers = currentInnings?.batting_team_id === team1.id ? team1Players : team2Players;
  const bowlingTeamPlayers = currentInnings?.bowling_team_id === team1.id ? team1Players : team2Players;

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

      const inn1 = data.find((i) => i.innings_number === 1);
      const inn2 = data.find((i) => i.innings_number === 2);
      if (inn1) setTeam1Score({ runs: inn1.total_runs, wickets: inn1.total_wickets, overs: inn1.total_overs });
      if (inn2) setTeam2Score({ runs: inn2.total_runs, wickets: inn2.total_wickets, overs: inn2.total_overs });
    }
    setLoading(false);
  };

  const fetchBalls = async (inningsId: string) => {
    const { data } = await supabase
      .from('match_balls')
      .select('*')
      .eq('innings_id', inningsId)
      .order('created_at');

    if (data) setBalls(data as MatchBall[]);
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
      toast({ title: 'Over Complete', description: `Over ${currentOver + 1} completed` });
    }

    // Reset wicket state
    if (isWicket) {
      setStrikerBatsman('');
      setIsWicket(false);
      setWicketType('');
      setSelectedFielder('');
    }

    fetchInnings();
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
      <div className="flex items-center gap-3 p-3 border-b bg-orange-500 text-white rounded-t-lg">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-orange-600">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="font-semibold">Match Centre</span>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-4 bg-orange-500 rounded-none">
          <TabsTrigger value="scoring" className="text-white data-[state=active]:bg-orange-600">Scoring</TabsTrigger>
          <TabsTrigger value="scorecard" className="text-white data-[state=active]:bg-orange-600">Scorecard</TabsTrigger>
          <TabsTrigger value="balls" className="text-white data-[state=active]:bg-orange-600">Balls</TabsTrigger>
          <TabsTrigger value="info" className="text-white data-[state=active]:bg-orange-600">Info</TabsTrigger>
        </TabsList>

        <TabsContent value="scoring" className="flex-1 flex flex-col overflow-auto p-0 m-0">
          {currentInnings ? (
            <div className="flex flex-col flex-1">
              {/* Score Display */}
              <div className="bg-gradient-to-b from-gray-800 to-gray-900 text-white p-4 text-center">
                <p className="text-sm text-gray-300">{battingTeam.team_name}</p>
                <p className="text-xs text-gray-400">Innings {currentInnings.innings_number}</p>
                <p className="text-5xl font-bold text-emerald-400 my-2">
                  {currentInnings.total_runs}-{currentInnings.total_wickets}
                </p>
                <div className="flex justify-center gap-6 text-sm text-gray-300">
                  <span>Ex - {currentInnings.extras}</span>
                  <span>Ov - {currentOver}.{currentBall}/{match.overs_per_innings}</span>
                  <span>CRR - {currentRR.toFixed(1)}</span>
                </div>
                {target > 0 && (
                  <div className="mt-2 text-sm">
                    <span className="text-gray-300">Target {target}</span>
                    <span className="mx-2">•</span>
                    <span className="text-gray-300">Req. RR - {reqRR.toFixed(1)}</span>
                    <p className="text-xs text-gray-400 mt-1">
                      Need {target - currentInnings.total_runs} Runs of {(match.overs_per_innings * 6) - legalDeliveries}
                    </p>
                  </div>
                )}
              </div>

              {/* Batsmen & Bowler Stats */}
              <div className="bg-white p-3 border-b">
                <div className="text-xs text-gray-500 mb-2 flex justify-between">
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
                  <div className="flex justify-between items-center">
                    <Select value={strikerBatsman} onValueChange={setStrikerBatsman}>
                      <SelectTrigger className="w-40 h-8 text-sm">
                        <SelectValue placeholder="Striker *" />
                      </SelectTrigger>
                      <SelectContent>
                        {battingTeamPlayers.filter(p => p.id !== nonStrikerBatsman).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-4 text-sm text-center">
                      <span className="w-8">-</span>
                      <span className="w-8">-</span>
                      <span className="w-8">-</span>
                      <span className="w-8">-</span>
                      <span className="w-12">-</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <Select value={nonStrikerBatsman} onValueChange={setNonStrikerBatsman}>
                      <SelectTrigger className="w-40 h-8 text-sm bg-emerald-50">
                        <SelectValue placeholder="Non-Striker" />
                      </SelectTrigger>
                      <SelectContent>
                        {battingTeamPlayers.filter(p => p.id !== strikerBatsman).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-4 text-sm text-center">
                      <span className="w-8">-</span>
                      <span className="w-8">-</span>
                      <span className="w-8">-</span>
                      <span className="w-8">-</span>
                      <span className="w-12">-</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t">
                  <div className="text-xs text-gray-500 mb-2 flex justify-between">
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
                    <Select value={currentBowler} onValueChange={setCurrentBowler}>
                      <SelectTrigger className="w-40 h-8 text-sm">
                        <SelectValue placeholder="Select Bowler *" />
                      </SelectTrigger>
                      <SelectContent>
                        {bowlingTeamPlayers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-4 text-sm text-center">
                      <span className="w-8">-</span>
                      <span className="w-8">-</span>
                      <span className="w-8">-</span>
                      <span className="w-8">-</span>
                      <span className="w-12">-</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* This Over Display */}
              <div className="bg-gray-100 p-2 flex items-center gap-2 border-b">
                <span className="text-xs text-gray-500">Over {currentOver + 1}:</span>
                <div className="flex gap-1 flex-wrap">
                  {currentOverBalls.map((ball, i) => (
                    <Badge
                      key={i}
                      variant={ball.is_wicket ? 'destructive' : 'secondary'}
                      className={`text-xs ${ball.runs_scored >= 4 ? 'bg-green-500 text-white' : ''}`}
                    >
                      {getBallDisplay(ball)}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Run Buttons */}
              <div className="p-3 bg-white flex-1">
                <div className="grid grid-cols-6 gap-2 mb-3">
                  {[1, 2, 3, 4, 5, 6].map((run) => (
                    <Button
                      key={run}
                      onClick={() => recordBall(run)}
                      className={`h-12 text-lg font-bold ${run === 4 || run === 6 ? 'bg-green-500 hover:bg-green-600' : 'bg-amber-500 hover:bg-amber-600'}`}
                    >
                      {run}
                    </Button>
                  ))}
                </div>

                {/* Extras Row */}
                <div className="grid grid-cols-6 gap-2 mb-3">
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
                </div>

                {/* Wicket Selection */}
                {isWicket && (
                  <div className="p-3 bg-red-50 rounded-lg mb-3 space-y-2">
                    <Label className="text-sm text-red-700">Wicket Type</Label>
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
                        <SelectContent>
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
