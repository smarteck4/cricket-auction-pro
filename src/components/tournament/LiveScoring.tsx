import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Match, MatchInnings, MatchBall, PlayerMatchStats } from '@/lib/tournament-types';
import { Player, Owner } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Play, Square, Plus, Undo2, AlertCircle } from 'lucide-react';

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
  const [currentInnings, setCurrentInnings] = useState<MatchInnings | null>(null);
  const [balls, setBalls] = useState<MatchBall[]>([]);
  const [loading, setLoading] = useState(true);

  // Scoring state
  const [selectedBatsman, setSelectedBatsman] = useState('');
  const [selectedBowler, setSelectedBowler] = useState('');
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

  const battingTeamPlayers = currentInnings?.batting_team_id === team1.id ? team1Players : team2Players;
  const bowlingTeamPlayers = currentInnings?.bowling_team_id === team1.id ? team1Players : team2Players;

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

      // Populate simple scores from innings
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
      .order('over_number')
      .order('ball_number');

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

    // Start the match if not started
    if (match.status === 'scheduled') {
      await supabase.from('matches').update({ status: 'live' }).eq('id', match.id);
      onMatchUpdate();
    }

    toast({ title: 'Innings Started', description: `Innings ${inningsNumber} has begun` });
    fetchInnings();
  };

  const recordBall = async () => {
    if (!currentInnings || !selectedBatsman || !selectedBowler) {
      toast({ title: 'Error', description: 'Select batsman and bowler', variant: 'destructive' });
      return;
    }

    const lastBall = balls[balls.length - 1];
    let overNumber = lastBall?.over_number || 0;
    let ballNumber = (lastBall?.ball_number || 0) + 1;

    // Handle over completion (skip for wides/no-balls)
    if (ballNumber > 6 && !['wide', 'no_ball'].includes(extraType)) {
      overNumber += 1;
      ballNumber = 1;
    }

    const { error } = await supabase.from('match_balls').insert({
      innings_id: currentInnings.id,
      over_number: overNumber,
      ball_number: ballNumber,
      batsman_id: selectedBatsman,
      bowler_id: selectedBowler,
      runs_scored: runsScored,
      extras: extras,
      extra_type: extraType || null,
      is_wicket: isWicket,
      wicket_type: isWicket ? wicketType : null,
      fielder_id: selectedFielder || null,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    // Update innings totals
    const newTotalRuns = currentInnings.total_runs + runsScored + extras;
    const newTotalWickets = currentInnings.total_wickets + (isWicket ? 1 : 0);
    const newTotalOvers = overNumber + ballNumber / 10;

    await supabase
      .from('match_innings')
      .update({
        total_runs: newTotalRuns,
        total_wickets: newTotalWickets,
        total_overs: newTotalOvers,
      })
      .eq('id', currentInnings.id);

    // Reset form
    setRunsScored(0);
    setExtras(0);
    setExtraType('');
    setIsWicket(false);
    setWicketType('');
    setSelectedFielder('');

    fetchInnings();
    toast({ title: 'Ball Recorded' });
  };

  const endInnings = async () => {
    if (!currentInnings) return;

    await supabase
      .from('match_innings')
      .update({ is_completed: true })
      .eq('id', currentInnings.id);

    toast({ title: 'Innings Completed' });
    fetchInnings();
  };

  const saveSimpleScore = async () => {
    // Create or update innings with simple scores
    const existingInn1 = innings.find((i) => i.innings_number === 1);
    const existingInn2 = innings.find((i) => i.innings_number === 2);

    if (existingInn1) {
      await supabase
        .from('match_innings')
        .update({
          total_runs: team1Score.runs,
          total_wickets: team1Score.wickets,
          total_overs: team1Score.overs,
          is_completed: true,
        })
        .eq('id', existingInn1.id);
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
      await supabase
        .from('match_innings')
        .update({
          total_runs: team2Score.runs,
          total_wickets: team2Score.wickets,
          total_overs: team2Score.overs,
          is_completed: true,
        })
        .eq('id', existingInn2.id);
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
    await supabase
      .from('matches')
      .update({
        status: 'completed',
        winner_id: winnerId || null,
      })
      .eq('id', match.id);

    toast({ title: 'Match Completed' });
    onMatchUpdate();
    onClose();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Match Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">
            {team1.team_name} vs {team2.team_name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {match.format} • {match.overs_per_innings} overs
          </p>
        </div>
        <Badge variant={match.status === 'live' ? 'default' : 'secondary'}>
          {match.status.toUpperCase()}
        </Badge>
      </div>

      {/* Scoring Mode Toggle */}
      <div className="flex gap-2">
        <Button
          variant={simpleMode ? 'default' : 'outline'}
          onClick={() => setSimpleMode(true)}
          size="sm"
        >
          Simple Scoring
        </Button>
        <Button
          variant={!simpleMode ? 'default' : 'outline'}
          onClick={() => setSimpleMode(false)}
          size="sm"
        >
          Ball-by-Ball
        </Button>
      </div>

      {simpleMode ? (
        /* Simple Scoring Mode */
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{team1.team_name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Runs</Label>
                  <Input
                    type="number"
                    value={team1Score.runs}
                    onChange={(e) => setTeam1Score({ ...team1Score, runs: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Wickets</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={team1Score.wickets}
                    onChange={(e) => setTeam1Score({ ...team1Score, wickets: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Overs</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={team1Score.overs}
                    onChange={(e) => setTeam1Score({ ...team1Score, overs: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{team2.team_name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Runs</Label>
                  <Input
                    type="number"
                    value={team2Score.runs}
                    onChange={(e) => setTeam2Score({ ...team2Score, runs: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Wickets</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={team2Score.wickets}
                    onChange={(e) => setTeam2Score({ ...team2Score, wickets: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Overs</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={team2Score.overs}
                    onChange={(e) => setTeam2Score({ ...team2Score, overs: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

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

          <div className="flex gap-2">
            <Button onClick={saveSimpleScore}>Save Scores</Button>
            <Button onClick={completeMatch} variant="default">
              Complete Match
            </Button>
          </div>
        </div>
      ) : (
        /* Ball-by-Ball Mode */
        <div className="space-y-4">
          {/* Current Score Display */}
          {innings.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {innings.map((inn) => (
                <Card key={inn.id} className={!inn.is_completed ? 'ring-2 ring-primary' : ''}>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">
                      Innings {inn.innings_number}
                    </p>
                    <p className="text-2xl font-bold">
                      {inn.total_runs}/{inn.total_wickets}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ({inn.total_overs.toFixed(1)} overs)
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Start Innings */}
          {!currentInnings && innings.filter((i) => !i.is_completed).length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Start Innings {innings.length + 1}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    onClick={() => startInnings(team1.id, team2.id)}
                    className="flex-1"
                  >
                    {team1.team_name} Bats
                  </Button>
                  <Button
                    onClick={() => startInnings(team2.id, team1.id)}
                    className="flex-1"
                  >
                    {team2.team_name} Bats
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ball Recording */}
          {currentInnings && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Record Ball</span>
                  <Button variant="outline" size="sm" onClick={endInnings}>
                    <Square className="h-4 w-4 mr-2" /> End Innings
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Batsman</Label>
                    <Select value={selectedBatsman} onValueChange={setSelectedBatsman}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select batsman" />
                      </SelectTrigger>
                      <SelectContent>
                        {battingTeamPlayers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Bowler</Label>
                    <Select value={selectedBowler} onValueChange={setSelectedBowler}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bowler" />
                      </SelectTrigger>
                      <SelectContent>
                        {bowlingTeamPlayers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Quick Run Buttons */}
                <div className="space-y-2">
                  <Label>Runs</Label>
                  <div className="flex gap-2 flex-wrap">
                    {[0, 1, 2, 3, 4, 6].map((r) => (
                      <Button
                        key={r}
                        variant={runsScored === r ? 'default' : 'outline'}
                        onClick={() => setRunsScored(r)}
                        className="w-12 h-12"
                      >
                        {r}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Extras */}
                <div className="space-y-2">
                  <Label>Extras</Label>
                  <div className="flex gap-2 flex-wrap">
                    {['wide', 'no_ball', 'bye', 'leg_bye'].map((et) => (
                      <Button
                        key={et}
                        variant={extraType === et ? 'default' : 'outline'}
                        onClick={() => {
                          setExtraType(extraType === et ? '' : et);
                          if (extraType !== et) setExtras(1);
                          else setExtras(0);
                        }}
                        size="sm"
                      >
                        {et.replace('_', ' ').toUpperCase()}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Wicket */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={isWicket ? 'destructive' : 'outline'}
                      onClick={() => setIsWicket(!isWicket)}
                    >
                      <AlertCircle className="h-4 w-4 mr-2" />
                      WICKET
                    </Button>
                  </div>
                  {isWicket && (
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <Select value={wicketType} onValueChange={setWicketType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Wicket type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bowled">Bowled</SelectItem>
                          <SelectItem value="caught">Caught</SelectItem>
                          <SelectItem value="lbw">LBW</SelectItem>
                          <SelectItem value="run_out">Run Out</SelectItem>
                          <SelectItem value="stumped">Stumped</SelectItem>
                          <SelectItem value="hit_wicket">Hit Wicket</SelectItem>
                        </SelectContent>
                      </Select>
                      {['caught', 'run_out', 'stumped'].includes(wicketType) && (
                        <Select value={selectedFielder} onValueChange={setSelectedFielder}>
                          <SelectTrigger>
                            <SelectValue placeholder="Fielder" />
                          </SelectTrigger>
                          <SelectContent>
                            {bowlingTeamPlayers.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>

                <Button onClick={recordBall} className="w-full">
                  <Plus className="h-4 w-4 mr-2" /> Record Ball
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Recent Balls */}
          {balls.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Deliveries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {balls.slice(-12).map((ball, i) => (
                    <Badge
                      key={ball.id}
                      variant={ball.is_wicket ? 'destructive' : ball.runs_scored >= 4 ? 'default' : 'secondary'}
                    >
                      {ball.is_wicket ? 'W' : ball.runs_scored + (ball.extras > 0 ? `+${ball.extras}` : '')}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Complete Match */}
          {innings.length >= 2 && innings.every((i) => i.is_completed) && (
            <div className="space-y-4">
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
              <Button onClick={completeMatch} className="w-full">
                Complete Match
              </Button>
            </div>
          )}
        </div>
      )}

      <Button variant="outline" onClick={onClose} className="w-full">
        Close
      </Button>
    </div>
  );
}
