import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header';
import { CategoryBadge } from '@/components/CategoryBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Player, Owner, CurrentAuction, MIN_TEAM_REQUIREMENTS, ROLE_LABELS, PlayerCategory, TeamPlayer } from '@/lib/types';
import { Gavel, Users, TrendingUp, Clock, User, AlertCircle, Square, Timer } from 'lucide-react';

export default function Auction() {
  const { user, role, owner } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [currentAuction, setCurrentAuction] = useState<CurrentAuction | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [currentBidder, setCurrentBidder] = useState<Owner | null>(null);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidding, setBidding] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const closingRef = useRef(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    fetchData();
    setupRealtimeSubscription();
  }, [user, navigate]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch current auction
    const { data: auctionData } = await supabase
      .from('current_auction')
      .select('*')
      .limit(1)
      .single();
    
    if (auctionData) {
      setCurrentAuction(auctionData as CurrentAuction);
      
      if (auctionData.player_id) {
        const { data: playerData } = await supabase
          .from('players')
          .select('*')
          .eq('id', auctionData.player_id)
          .single();
        if (playerData) setCurrentPlayer(playerData as Player);
      }
      
      if (auctionData.current_bidder_id) {
        const { data: bidderData } = await supabase
          .from('owners')
          .select('*')
          .eq('id', auctionData.current_bidder_id)
          .single();
        if (bidderData) setCurrentBidder(bidderData as Owner);
      }
    }
    
    // Fetch owners
    const { data: ownersData } = await supabase
      .from('owners')
      .select('*');
    if (ownersData) setOwners(ownersData as Owner[]);
    
    // Fetch team players for current owner
    if (owner) {
      const { data: teamData } = await supabase
        .from('team_players')
        .select('*, player:players(*)')
        .eq('owner_id', owner.id);
      if (teamData) setTeamPlayers(teamData as any);
    }
    
    setLoading(false);
  };

  const setupRealtimeSubscription = () => {
    const auctionChannel = supabase
      .channel('auction-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'current_auction' },
        async (payload) => {
          const auction = payload.new as CurrentAuction;
          setCurrentAuction(auction);
          
          if (auction.player_id) {
            const { data: playerData } = await supabase
              .from('players')
              .select('*')
              .eq('id', auction.player_id)
              .single();
            if (playerData) setCurrentPlayer(playerData as Player);
          } else {
            setCurrentPlayer(null);
          }
          
          if (auction.current_bidder_id) {
            const { data: bidderData } = await supabase
              .from('owners')
              .select('*')
              .eq('id', auction.current_bidder_id)
              .single();
            if (bidderData) setCurrentBidder(bidderData as Owner);
          } else {
            setCurrentBidder(null);
          }
        }
      )
      .subscribe();

    const teamChannel = supabase
      .channel('team-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_players' },
        () => {
          if (owner) {
            fetchTeamPlayers();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(auctionChannel);
      supabase.removeChannel(teamChannel);
    };
  };

  const fetchTeamPlayers = async () => {
    if (!owner) return;
    const { data: teamData } = await supabase
      .from('team_players')
      .select('*, player:players(*)')
      .eq('owner_id', owner.id);
    if (teamData) setTeamPlayers(teamData as any);
  };

  const calculateMinPointsNeeded = () => {
    if (!owner) return 0;
    
    const categoryCounts: Record<PlayerCategory, number> = {
      platinum: 0,
      gold: 0,
      silver: 0,
      emerging: 0,
    };
    
    teamPlayers.forEach((tp) => {
      if (tp.player) {
        categoryCounts[tp.player.category]++;
      }
    });
    
    const stillNeeded: Record<PlayerCategory, number> = {
      platinum: Math.max(0, MIN_TEAM_REQUIREMENTS.platinum - categoryCounts.platinum),
      gold: Math.max(0, MIN_TEAM_REQUIREMENTS.gold - categoryCounts.gold),
      silver: Math.max(0, MIN_TEAM_REQUIREMENTS.silver - categoryCounts.silver),
      emerging: Math.max(0, MIN_TEAM_REQUIREMENTS.emerging - categoryCounts.emerging),
    };
    
    // Estimate minimum points needed (using base prices)
    const basePrices = { platinum: 500, gold: 300, silver: 150, emerging: 100 };
    let minNeeded = 0;
    
    Object.entries(stillNeeded).forEach(([cat, count]) => {
      minNeeded += basePrices[cat as PlayerCategory] * count;
    });
    
    return minNeeded;
  };

  const canBid = (bidAmount: number) => {
    if (!owner || !currentPlayer) return false;
    
    const minPointsNeeded = calculateMinPointsNeeded();
    const availableForBid = owner.remaining_points - minPointsNeeded;
    
    // If this player is in a category we still need, we can use more points
    const categoryCounts: Record<PlayerCategory, number> = {
      platinum: 0,
      gold: 0,
      silver: 0,
      emerging: 0,
    };
    
    teamPlayers.forEach((tp) => {
      if (tp.player) {
        categoryCounts[tp.player.category]++;
      }
    });
    
    const needThisCategory = 
      categoryCounts[currentPlayer.category] < MIN_TEAM_REQUIREMENTS[currentPlayer.category];
    
    if (needThisCategory) {
      // Recalculate without this category
      const basePrices = { platinum: 500, gold: 300, silver: 150, emerging: 100 };
      const stillNeeded = Math.max(0, MIN_TEAM_REQUIREMENTS[currentPlayer.category] - categoryCounts[currentPlayer.category] - 1);
      const adjustedMin = minPointsNeeded - basePrices[currentPlayer.category] + (stillNeeded * basePrices[currentPlayer.category]);
      return bidAmount <= (owner.remaining_points - adjustedMin);
    }
    
    return bidAmount <= availableForBid;
  };

  const placeBid = async () => {
    if (!owner || !currentAuction || !currentPlayer) return;
    
    const bidIncrement = Math.max(50, Math.floor(currentAuction.current_bid * 0.1));
    const newBid = currentAuction.current_bid + bidIncrement;
    
    if (!canBid(newBid)) {
      toast({
        title: 'Cannot place bid',
        description: 'You need to reserve points for remaining required players.',
        variant: 'destructive',
      });
      return;
    }
    
    setBidding(true);
    
    // Place bid
    const { error: bidError } = await supabase
      .from('bids')
      .insert({
        player_id: currentPlayer.id,
        owner_id: owner.id,
        bid_amount: newBid,
      });
    
    if (bidError) {
      toast({
        title: 'Error placing bid',
        description: bidError.message,
        variant: 'destructive',
      });
      setBidding(false);
      return;
    }
    
    // Update current auction with reset timer
    const { error: updateError } = await supabase
      .from('current_auction')
      .update({
        current_bid: newBid,
        current_bidder_id: owner.id,
        timer_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentAuction.id);
    
    if (updateError) {
      toast({
        title: 'Error updating auction',
        description: updateError.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Bid placed!',
        description: `You bid ${newBid} points`,
      });
    }
    
    setBidding(false);
  };

  const closeBid = async () => {
    if (!currentAuction) return;

    if (currentBidder && currentPlayer) {
      // Player sold to current bidder
      await supabase.from('team_players').insert({
        owner_id: currentBidder.id,
        player_id: currentPlayer.id,
        bought_price: currentAuction.current_bid,
      });
      
      // Deduct points from owner
      await supabase.from('owners').update({
        remaining_points: currentBidder.remaining_points - currentAuction.current_bid
      }).eq('id', currentBidder.id);
      
      await supabase.from('players').update({ auction_status: 'sold' }).eq('id', currentPlayer.id);
      toast({ title: 'Player Sold!', description: `${currentPlayer.name} sold to ${currentBidder.team_name} for ${currentAuction.current_bid} points` });
    } else if (currentPlayer) {
      await supabase.from('players').update({ auction_status: 'unsold' }).eq('id', currentPlayer.id);
      toast({ title: 'Player Unsold', description: `${currentPlayer.name} received no bids` });
    }
    
    // Reset auction
    await supabase.from('current_auction').update({ 
      is_active: false, 
      player_id: null, 
      current_bidder_id: null, 
      current_bid: 0,
      timer_started_at: null
    }).eq('id', currentAuction.id);
  };

  // Auto-close when timer expires
  const autoCloseBid = useCallback(async () => {
    if (closingRef.current || !currentAuction?.is_active) return;
    closingRef.current = true;

    // Fetch fresh bidder data for accurate points
    let bidder = currentBidder;
    if (currentAuction.current_bidder_id) {
      const { data } = await supabase
        .from('owners')
        .select('*')
        .eq('id', currentAuction.current_bidder_id)
        .single();
      if (data) bidder = data as Owner;
    }

    if (bidder && currentPlayer) {
      await supabase.from('team_players').insert({
        owner_id: bidder.id,
        player_id: currentPlayer.id,
        bought_price: currentAuction.current_bid,
      });
      
      await supabase.from('owners').update({
        remaining_points: bidder.remaining_points - currentAuction.current_bid
      }).eq('id', bidder.id);
      
      await supabase.from('players').update({ auction_status: 'sold' }).eq('id', currentPlayer.id);
      toast({ title: 'Time Up - Player Sold!', description: `${currentPlayer.name} sold to ${bidder.team_name}` });
    } else if (currentPlayer) {
      await supabase.from('players').update({ auction_status: 'unsold' }).eq('id', currentPlayer.id);
      toast({ title: 'Time Up - Player Unsold', description: `${currentPlayer.name} received no bids` });
    }
    
    await supabase.from('current_auction').update({ 
      is_active: false, 
      player_id: null, 
      current_bidder_id: null, 
      current_bid: 0,
      timer_started_at: null
    }).eq('id', currentAuction.id);
    
    closingRef.current = false;
  }, [currentAuction, currentBidder, currentPlayer, toast]);

  // Timer countdown effect
  useEffect(() => {
    if (!currentAuction?.is_active || !currentAuction.timer_started_at) {
      setTimeRemaining(0);
      return;
    }

    const calculateRemaining = () => {
      const startTime = new Date(currentAuction.timer_started_at!).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, currentAuction.timer_duration - elapsed);
      return remaining;
    };

    setTimeRemaining(calculateRemaining());

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setTimeRemaining(remaining);
      
      if (remaining <= 0 && role === 'admin' && !closingRef.current) {
        clearInterval(interval);
        autoCloseBid();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentAuction?.is_active, currentAuction?.timer_started_at, currentAuction?.timer_duration, role, autoCloseBid]);

  const getBidIncrement = () => {
    if (!currentAuction) return 50;
    return Math.max(50, Math.floor(currentAuction.current_bid * 0.1));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-20 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading auction...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold">Live Auction</h1>
            <p className="text-muted-foreground">
              {currentAuction?.is_active ? 'Bidding is active' : 'Waiting for auction to start'}
            </p>
          </div>
          {owner && (
            <Card className="card-shadow">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Your Balance</p>
                  <p className="font-display text-2xl font-bold text-gradient-gold">
                    {owner.remaining_points.toLocaleString()}
                  </p>
                </div>
                <div className="h-12 w-px bg-border" />
                <div>
                  <p className="text-sm text-muted-foreground">Team</p>
                  <p className="font-medium">{owner.team_name}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Auction Area */}
          <div className="lg:col-span-2 space-y-6">
            {currentAuction?.is_active && currentPlayer ? (
              <Card className="card-shadow-lg overflow-hidden">
                <div className="relative">
                  {currentPlayer.profile_picture_url ? (
                    <img
                      src={currentPlayer.profile_picture_url}
                      alt={currentPlayer.name}
                      className="w-full h-64 object-cover"
                    />
                  ) : (
                    <div className="w-full h-64 bg-muted flex items-center justify-center">
                      <User className="w-24 h-24 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute top-4 left-4">
                    <CategoryBadge category={currentPlayer.category} />
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                    <h2 className="font-display text-3xl font-bold text-white mb-1">
                      {currentPlayer.name}
                    </h2>
                    <p className="text-white/80">
                      {currentPlayer.nationality} • {currentPlayer.age} years • {ROLE_LABELS[currentPlayer.player_role]}
                    </p>
                  </div>
                </div>

                <CardContent className="p-6">
                  {/* Timer Display */}
                  {currentAuction.timer_started_at && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Timer className={`w-5 h-5 ${timeRemaining <= 5 ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
                          <span className="text-sm font-medium">Time Remaining</span>
                        </div>
                        <span className={`font-display text-2xl font-bold ${timeRemaining <= 5 ? 'text-destructive animate-pulse' : timeRemaining <= 10 ? 'text-amber-500' : 'text-foreground'}`}>
                          {timeRemaining}s
                        </span>
                      </div>
                      <Progress 
                        value={(timeRemaining / currentAuction.timer_duration) * 100} 
                        className={`h-3 ${timeRemaining <= 5 ? '[&>div]:bg-destructive' : timeRemaining <= 10 ? '[&>div]:bg-amber-500' : ''}`}
                      />
                    </div>
                  )}

                  {/* Current Bid Display */}
                  <div className="bg-muted rounded-xl p-6 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Current Bid</p>
                        <p className="font-display text-4xl font-bold text-gradient-gold animate-pulse-slow">
                          {currentAuction.current_bid.toLocaleString()} pts
                        </p>
                      </div>
                      {currentBidder && (
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground mb-2">Leading Bidder</p>
                          <div className="flex items-center gap-4">
                            {currentBidder.team_logo_url ? (
                              <img
                                src={currentBidder.team_logo_url}
                                alt={currentBidder.team_name}
                                className="w-16 h-16 rounded-xl object-cover ring-4 ring-primary/30 shadow-lg animate-pulse-slow"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-xl gradient-gold flex items-center justify-center ring-4 ring-primary/30 shadow-lg animate-pulse-slow">
                                <Users className="w-8 h-8 text-primary-foreground" />
                              </div>
                            )}
                            <span className="font-display font-bold text-lg">{currentBidder.team_name}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Admin Close Bid Button */}
                  {role === 'admin' && (
                    <div className="mb-6">
                      <Button
                        size="lg"
                        variant="destructive"
                        className="w-full h-12"
                        onClick={closeBid}
                      >
                        <Square className="w-5 h-5 mr-2" />
                        Close Bid {currentBidder ? `(Sell to ${currentBidder.team_name})` : '(Mark Unsold)'}
                      </Button>
                    </div>
                  )}

                  {/* Player Stats */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-3 bg-secondary/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Matches</p>
                      <p className="font-display text-xl font-bold">{currentPlayer.total_matches}</p>
                    </div>
                    <div className="text-center p-3 bg-secondary/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Runs</p>
                      <p className="font-display text-xl font-bold">{currentPlayer.total_runs}</p>
                    </div>
                    <div className="text-center p-3 bg-secondary/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Strike Rate</p>
                      <p className="font-display text-xl font-bold">{currentPlayer.strike_rate}</p>
                    </div>
                    <div className="text-center p-3 bg-secondary/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Wickets</p>
                      <p className="font-display text-xl font-bold">{currentPlayer.wickets}</p>
                    </div>
                  </div>

                  {/* Bid Button */}
                  {role === 'owner' && owner && (
                    <div className="space-y-4">
                      {!canBid(currentAuction.current_bid + getBidIncrement()) && (
                        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                          <AlertCircle className="w-5 h-5" />
                          <span className="text-sm">Insufficient points for bid (reserve for required players)</span>
                        </div>
                      )}
                      <Button
                        size="lg"
                        className="w-full gradient-gold glow-gold text-lg h-14"
                        onClick={placeBid}
                        disabled={bidding || !canBid(currentAuction.current_bid + getBidIncrement())}
                      >
                        <Gavel className="w-5 h-5 mr-2" />
                        Bid {(currentAuction.current_bid + getBidIncrement()).toLocaleString()} pts
                        <span className="ml-2 text-sm opacity-80">(+{getBidIncrement()})</span>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="card-shadow">
                <CardContent className="py-20 text-center">
                  <Clock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-display text-xl font-semibold mb-2">No Active Auction</h3>
                  <p className="text-muted-foreground">
                    Waiting for the admin to start a player auction.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Your Team Progress */}
            {owner && (
              <Card className="card-shadow">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Your Team
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Players</span>
                    <span className="font-semibold">{teamPlayers.length} / {MIN_TEAM_REQUIREMENTS.total}</span>
                  </div>
                  
                  <div className="space-y-2">
                    {(['platinum', 'gold', 'silver', 'emerging'] as const).map((cat) => {
                      const count = teamPlayers.filter((tp) => tp.player?.category === cat).length;
                      const required = MIN_TEAM_REQUIREMENTS[cat];
                      const met = count >= required;
                      
                      return (
                        <div key={cat} className="flex items-center justify-between text-sm">
                          <CategoryBadge category={cat} />
                          <span className={met ? 'text-accent font-medium' : 'text-muted-foreground'}>
                            {count} / {required}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Other Teams */}
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Team Standings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {owners.map((o) => (
                    <div
                      key={o.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        o.id === currentBidder?.id ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {o.team_logo_url ? (
                          <img
                            src={o.team_logo_url}
                            alt={o.team_name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                            <Users className="w-5 h-5 text-secondary-foreground" />
                          </div>
                        )}
                        <span className="font-medium">{o.team_name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {o.remaining_points.toLocaleString()} pts
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
