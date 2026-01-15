import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header';
import { CategoryBadge } from '@/components/CategoryBadge';
import { BidHistory } from '@/components/BidHistory';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Player, Owner, CategorySetting, PlayerCategory, PlayerRole, BattingHand, CATEGORY_LABELS, ROLE_LABELS, CurrentAuction } from '@/lib/types';
import { Plus, Play, Square, Users, Trash2, Edit, Gavel, Timer, User, AlertCircle, Search, X, Upload, Link } from 'lucide-react';
import { Tabs as RadioTabs, TabsList as RadioTabsList, TabsTrigger as RadioTabsTrigger } from '@/components/ui/tabs';

const defaultPlayer = {
  name: '', age: 20, nationality: '', category: 'gold' as PlayerCategory,
  player_role: 'batsman' as PlayerRole, batting_hand: 'right' as BattingHand,
  total_matches: 0, total_runs: 0, highest_score: 0, strike_rate: 0,
  wickets: 0, bowling_average: 0, economy_rate: 0, best_bowling: '', profile_picture_url: ''
};

const defaultOwner = { team_name: '', total_points: 10000, team_logo_url: '' };

export default function Admin() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [categorySettings, setCategorySettings] = useState<CategorySetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [playerDialogOpen, setPlayerDialogOpen] = useState(false);
  const [ownerDialogOpen, setOwnerDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  
  const [newPlayer, setNewPlayer] = useState(defaultPlayer);
  const [newOwner, setNewOwner] = useState(defaultOwner);
  const [timerDuration, setTimerDuration] = useState(30);
  const [imageUploadType, setImageUploadType] = useState<'url' | 'file'>('url');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PlayerCategory | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<PlayerRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'sold' | 'unsold'>('all');

  // Live auction state
  const [currentAuction, setCurrentAuction] = useState<CurrentAuction | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [currentBidder, setCurrentBidder] = useState<Owner | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const closingRef = useRef(false);

  // Filtered players
  const filteredPlayers = players.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.nationality.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    const matchesRole = roleFilter === 'all' || p.player_role === roleFilter;
    const matchesStatus = statusFilter === 'all' || p.auction_status === statusFilter;
    return matchesSearch && matchesCategory && matchesRole && matchesStatus;
  });

  useEffect(() => {
    if (!user || role !== 'admin') {
      navigate('/');
      return;
    }
    fetchData();
    setupRealtimeSubscription();
  }, [user, role, navigate]);

  const fetchData = async () => {
    const [playersRes, ownersRes, settingsRes, auctionRes] = await Promise.all([
      supabase.from('players').select('*').order('category'),
      supabase.from('owners').select('*'),
      supabase.from('category_settings').select('*'),
      supabase.from('current_auction').select('*').limit(1).single(),
    ]);
    
    if (playersRes.data) setPlayers(playersRes.data as Player[]);
    if (ownersRes.data) setOwners(ownersRes.data as Owner[]);
    if (settingsRes.data) setCategorySettings(settingsRes.data as CategorySetting[]);
    
    if (auctionRes.data) {
      setCurrentAuction(auctionRes.data as CurrentAuction);
      if (auctionRes.data.player_id) {
        const { data: player } = await supabase.from('players').select('*').eq('id', auctionRes.data.player_id).single();
        if (player) setCurrentPlayer(player as Player);
      }
      if (auctionRes.data.current_bidder_id) {
        const { data: bidder } = await supabase.from('owners').select('*').eq('id', auctionRes.data.current_bidder_id).single();
        if (bidder) setCurrentBidder(bidder as Owner);
      }
    }
    
    setLoading(false);
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('admin-auction-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'current_auction' }, async (payload) => {
        const auction = payload.new as CurrentAuction;
        setCurrentAuction(auction);
        
        if (auction.player_id) {
          const { data: player } = await supabase.from('players').select('*').eq('id', auction.player_id).single();
          if (player) setCurrentPlayer(player as Player);
        } else {
          setCurrentPlayer(null);
        }
        
        if (auction.current_bidder_id) {
          const { data: bidder } = await supabase.from('owners').select('*').eq('id', auction.current_bidder_id).single();
          if (bidder) setCurrentBidder(bidder as Owner);
        } else {
          setCurrentBidder(null);
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  };

  // Timer countdown
  const autoCloseBid = useCallback(async () => {
    if (closingRef.current || !currentAuction?.is_active) return;
    closingRef.current = true;

    let bidder = currentBidder;
    if (currentAuction.current_bidder_id) {
      const { data } = await supabase.from('owners').select('*').eq('id', currentAuction.current_bidder_id).single();
      if (data) bidder = data as Owner;
    }

    if (bidder && currentPlayer) {
      await supabase.from('team_players').insert({
        owner_id: bidder.id,
        player_id: currentPlayer.id,
        bought_price: currentAuction.current_bid,
      });
      await supabase.from('owners').update({ remaining_points: bidder.remaining_points - currentAuction.current_bid }).eq('id', bidder.id);
      await supabase.from('players').update({ auction_status: 'sold' }).eq('id', currentPlayer.id);
      toast({ title: 'Time Up - Player Sold!', description: `${currentPlayer.name} sold to ${bidder.team_name}` });
    } else if (currentPlayer) {
      await supabase.from('players').update({ auction_status: 'unsold' }).eq('id', currentPlayer.id);
      toast({ title: 'Time Up - Player Unsold', description: `${currentPlayer.name} received no bids` });
    }
    
    await supabase.from('current_auction').update({ is_active: false, player_id: null, current_bidder_id: null, current_bid: 0, timer_started_at: null }).eq('id', currentAuction.id);
    closingRef.current = false;
    fetchData();
  }, [currentAuction, currentBidder, currentPlayer, toast]);

  useEffect(() => {
    if (!currentAuction?.is_active || !currentAuction.timer_started_at) {
      setTimeRemaining(0);
      return;
    }

    const calculateRemaining = () => {
      const startTime = new Date(currentAuction.timer_started_at!).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      return Math.max(0, currentAuction.timer_duration - elapsed);
    };

    setTimeRemaining(calculateRemaining());

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setTimeRemaining(remaining);
      if (remaining <= 0 && !closingRef.current) {
        clearInterval(interval);
        autoCloseBid();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentAuction?.is_active, currentAuction?.timer_started_at, currentAuction?.timer_duration, autoCloseBid]);

  // Upload image to storage
  const uploadPlayerImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `profiles/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('player-images')
      .upload(filePath, file);

    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('player-images')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  // Player CRUD
  const addPlayer = async () => {
    setUploadingImage(true);
    
    let profileUrl = newPlayer.profile_picture_url;
    
    // If file upload is selected and a file exists, upload it
    if (imageUploadType === 'file' && selectedImageFile) {
      const uploadedUrl = await uploadPlayerImage(selectedImageFile);
      if (uploadedUrl) {
        profileUrl = uploadedUrl;
      }
    }

    const basePrice = categorySettings.find(c => c.category === newPlayer.category)?.base_price || 100;
    const { error } = await supabase.from('players').insert({ 
      ...newPlayer, 
      profile_picture_url: profileUrl,
      base_price: basePrice 
    });
    
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Player added!' });
      setPlayerDialogOpen(false);
      setNewPlayer(defaultPlayer);
      setSelectedImageFile(null);
      setImageUploadType('url');
      fetchData();
    }
    setUploadingImage(false);
  };

  const updatePlayer = async () => {
    if (!editingPlayer) return;
    const { error } = await supabase.from('players').update(editingPlayer).eq('id', editingPlayer.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Player updated!' });
      setEditingPlayer(null);
      fetchData();
    }
  };

  const deletePlayer = async (id: string) => {
    await supabase.from('players').delete().eq('id', id);
    toast({ title: 'Player deleted' });
    fetchData();
  };

  // Owner CRUD
  const addOwner = async () => {
    const { error } = await supabase.from('owners').insert({
      team_name: newOwner.team_name,
      total_points: newOwner.total_points,
      remaining_points: newOwner.total_points,
      team_logo_url: newOwner.team_logo_url || null,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Owner added!' });
      setOwnerDialogOpen(false);
      setNewOwner(defaultOwner);
      fetchData();
    }
  };

  const updateOwner = async () => {
    if (!editingOwner) return;
    const { error } = await supabase.from('owners').update({
      team_name: editingOwner.team_name,
      total_points: editingOwner.total_points,
      team_logo_url: editingOwner.team_logo_url,
    }).eq('id', editingOwner.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Owner updated!' });
      setEditingOwner(null);
      fetchData();
    }
  };

  const deleteOwner = async (id: string) => {
    await supabase.from('owners').delete().eq('id', id);
    toast({ title: 'Owner deleted' });
    fetchData();
  };

  // Auction controls
  const startAuction = async (player: Player) => {
    const { data: existing } = await supabase.from('current_auction').select('id').limit(1);
    const now = new Date().toISOString();
    
    if (existing && existing.length > 0) {
      await supabase.from('current_auction').update({
        player_id: player.id,
        current_bid: player.base_price || 100,
        current_bidder_id: null,
        is_active: true,
        started_at: now,
        timer_duration: timerDuration,
        timer_started_at: now,
      }).eq('id', existing[0].id);
    } else {
      await supabase.from('current_auction').insert({
        player_id: player.id,
        current_bid: player.base_price || 100,
        is_active: true,
        started_at: now,
        timer_duration: timerDuration,
        timer_started_at: now,
      });
    }
    
    await supabase.from('players').update({ auction_status: 'active' }).eq('id', player.id);
    toast({ title: 'Auction started!', description: `Bidding open for ${player.name} (${timerDuration}s timer)` });
    fetchData();
  };

  const endAuction = async () => {
    if (!currentAuction) return;

    if (currentBidder && currentPlayer) {
      await supabase.from('team_players').insert({
        owner_id: currentBidder.id,
        player_id: currentPlayer.id,
        bought_price: currentAuction.current_bid,
      });
      await supabase.from('owners').update({ remaining_points: currentBidder.remaining_points - currentAuction.current_bid }).eq('id', currentBidder.id);
      await supabase.from('players').update({ auction_status: 'sold' }).eq('id', currentPlayer.id);
      toast({ title: 'Player sold!' });
    } else if (currentPlayer) {
      await supabase.from('players').update({ auction_status: 'unsold' }).eq('id', currentPlayer.id);
      toast({ title: 'Player unsold' });
    }
    
    await supabase.from('current_auction').update({ is_active: false, player_id: null, current_bidder_id: null, current_bid: 0, timer_started_at: null }).eq('id', currentAuction.id);
    fetchData();
  };

  if (loading) return <div className="min-h-screen bg-background"><Header /><div className="container py-20 text-center">Loading...</div></div>;

  const pendingPlayers = players.filter(p => p.auction_status === 'pending');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <h1 className="font-display text-3xl font-bold mb-8">Admin Panel</h1>
        
        <Tabs defaultValue="auction">
          <TabsList className="mb-6">
            <TabsTrigger value="auction"><Gavel className="w-4 h-4 mr-2" />Auction Control</TabsTrigger>
            <TabsTrigger value="players"><Users className="w-4 h-4 mr-2" />Players ({players.length})</TabsTrigger>
            <TabsTrigger value="owners"><Users className="w-4 h-4 mr-2" />Owners ({owners.length})</TabsTrigger>
          </TabsList>

          {/* AUCTION CONTROL TAB */}
          <TabsContent value="auction">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Live Auction View */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="card-shadow">
                  <CardHeader><CardTitle className="flex items-center gap-2"><Timer className="w-5 h-5" />Live Auction</CardTitle></CardHeader>
                  <CardContent>
                    {currentAuction?.is_active && currentPlayer ? (
                      <div className="space-y-4">
                        {/* Player Info */}
                        <div className="flex gap-4">
                          {currentPlayer.profile_picture_url ? (
                            <img src={currentPlayer.profile_picture_url} alt={currentPlayer.name} className="w-24 h-24 rounded-lg object-cover" />
                          ) : (
                            <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center"><User className="w-10 h-10 text-muted-foreground" /></div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-display text-xl font-bold">{currentPlayer.name}</h3>
                              <CategoryBadge category={currentPlayer.category} />
                            </div>
                            <p className="text-sm text-muted-foreground">{currentPlayer.nationality} • {currentPlayer.age}y • {ROLE_LABELS[currentPlayer.player_role]}</p>
                          </div>
                        </div>

                        {/* Timer */}
                        {currentAuction.timer_started_at && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Time Remaining</span>
                              <span className={`font-display text-2xl font-bold ${timeRemaining <= 5 ? 'text-destructive animate-pulse' : timeRemaining <= 10 ? 'text-amber-500' : ''}`}>
                                {timeRemaining}s
                              </span>
                            </div>
                            <Progress value={(timeRemaining / currentAuction.timer_duration) * 100} className={`h-3 ${timeRemaining <= 5 ? '[&>div]:bg-destructive' : timeRemaining <= 10 ? '[&>div]:bg-amber-500' : ''}`} />
                          </div>
                        )}

                        {/* Current Bid */}
                        <div className="bg-muted rounded-lg p-4 flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Current Bid</p>
                            <p className="font-display text-3xl font-bold text-gradient-gold">{currentAuction.current_bid.toLocaleString()}</p>
                          </div>
                          {currentBidder && (
                            <div className="text-right flex items-center gap-3">
                              {currentBidder.team_logo_url && <img src={currentBidder.team_logo_url} alt={currentBidder.team_name} className="w-10 h-10 rounded-full object-cover" />}
                              <div>
                                <p className="text-sm text-muted-foreground">Leading Bid</p>
                                <p className="font-semibold">{currentBidder.team_name}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Close Bid Button */}
                        <Button variant="destructive" size="lg" className="w-full" onClick={endAuction}>
                          <Square className="w-4 h-4 mr-2" />Close Bid Manually
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">No Active Auction</h3>
                        <p className="text-muted-foreground">Start an auction from the pending players below</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Bid History */}
                {currentAuction?.is_active && currentPlayer && (
                  <BidHistory playerId={currentPlayer.id} owners={owners} />
                )}

                {/* Timer Settings */}
                <Card className="card-shadow">
                  <CardHeader><CardTitle>Timer Settings</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <Label>Duration (seconds)</Label>
                      <Input type="number" value={timerDuration} onChange={e => setTimerDuration(Math.max(10, +e.target.value))} className="w-24" min={10} max={300} />
                      <span className="text-sm text-muted-foreground">Resets on each new bid. Auto-closes when timer reaches 0.</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Pending Players Queue */}
              <div>
                <Card className="card-shadow">
                  <CardHeader><CardTitle>Pending Players ({pendingPlayers.length})</CardTitle></CardHeader>
                  <CardContent className="max-h-[600px] overflow-y-auto space-y-3">
                    {pendingPlayers.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No pending players</p>
                    ) : (
                      pendingPlayers.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{ROLE_LABELS[p.player_role]} • Base: {p.base_price}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <CategoryBadge category={p.category} />
                            <Button size="sm" onClick={() => startAuction(p)} disabled={currentAuction?.is_active}>
                              <Play className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* PLAYERS TAB */}
          <TabsContent value="players">
            <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
              <h2 className="text-xl font-semibold">Manage Players</h2>
              <Dialog open={playerDialogOpen} onOpenChange={setPlayerDialogOpen}>
                <DialogTrigger asChild><Button className="gradient-gold"><Plus className="w-4 h-4 mr-2" />Add Player</Button></DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Add New Player</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Name</Label><Input value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})} /></div>
                    <div><Label>Age</Label><Input type="number" value={newPlayer.age} onChange={e => setNewPlayer({...newPlayer, age: +e.target.value})} /></div>
                    <div><Label>Nationality</Label><Input value={newPlayer.nationality} onChange={e => setNewPlayer({...newPlayer, nationality: e.target.value})} /></div>
                    <div><Label>Category</Label>
                      <Select value={newPlayer.category} onValueChange={v => setNewPlayer({...newPlayer, category: v as PlayerCategory})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(CATEGORY_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Role</Label>
                      <Select value={newPlayer.player_role} onValueChange={v => setNewPlayer({...newPlayer, player_role: v as PlayerRole})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(ROLE_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Batting Hand</Label>
                      <Select value={newPlayer.batting_hand} onValueChange={v => setNewPlayer({...newPlayer, batting_hand: v as BattingHand})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="right">Right</SelectItem><SelectItem value="left">Left</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div><Label>Matches</Label><Input type="number" value={newPlayer.total_matches} onChange={e => setNewPlayer({...newPlayer, total_matches: +e.target.value})} /></div>
                    <div><Label>Runs</Label><Input type="number" value={newPlayer.total_runs} onChange={e => setNewPlayer({...newPlayer, total_runs: +e.target.value})} /></div>
                    <div><Label>Highest Score</Label><Input type="number" value={newPlayer.highest_score} onChange={e => setNewPlayer({...newPlayer, highest_score: +e.target.value})} /></div>
                    <div><Label>Strike Rate</Label><Input type="number" step="0.01" value={newPlayer.strike_rate} onChange={e => setNewPlayer({...newPlayer, strike_rate: +e.target.value})} /></div>
                    
                    {/* Bowling Stats Section */}
                    <div className="col-span-2 pt-4 border-t">
                      <h4 className="font-medium text-sm text-muted-foreground mb-3">Bowling Statistics</h4>
                    </div>
                    <div><Label>Wickets</Label><Input type="number" value={newPlayer.wickets} onChange={e => setNewPlayer({...newPlayer, wickets: +e.target.value})} /></div>
                    <div><Label>Best Bowling (e.g. 5/23)</Label><Input placeholder="e.g. 5/23" value={newPlayer.best_bowling} onChange={e => setNewPlayer({...newPlayer, best_bowling: e.target.value})} /></div>
                    <div><Label>Bowling Average</Label><Input type="number" step="0.01" value={newPlayer.bowling_average} onChange={e => setNewPlayer({...newPlayer, bowling_average: +e.target.value})} /></div>
                    <div><Label>Economy Rate</Label><Input type="number" step="0.01" value={newPlayer.economy_rate} onChange={e => setNewPlayer({...newPlayer, economy_rate: +e.target.value})} /></div>
                    
                    {/* Profile Image Section */}
                    <div className="col-span-2 pt-4 border-t">
                      <h4 className="font-medium text-sm text-muted-foreground mb-3">Profile Image</h4>
                      <div className="flex gap-2 mb-3">
                        <Button
                          type="button"
                          variant={imageUploadType === 'url' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setImageUploadType('url')}
                          className="flex-1"
                        >
                          <Link className="w-4 h-4 mr-2" />
                          URL
                        </Button>
                        <Button
                          type="button"
                          variant={imageUploadType === 'file' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setImageUploadType('file')}
                          className="flex-1"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload
                        </Button>
                      </div>
                      
                      {imageUploadType === 'url' ? (
                        <Input 
                          placeholder="Enter image URL" 
                          value={newPlayer.profile_picture_url} 
                          onChange={e => setNewPlayer({...newPlayer, profile_picture_url: e.target.value})} 
                        />
                      ) : (
                        <div className="space-y-2">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) setSelectedImageFile(file);
                            }}
                          />
                          {selectedImageFile && (
                            <p className="text-sm text-muted-foreground">
                              Selected: {selectedImageFile.name}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button onClick={addPlayer} className="w-full mt-4 gradient-gold" disabled={uploadingImage}>
                    {uploadingImage ? 'Uploading...' : 'Add Player'}
                  </Button>
                </DialogContent>
              </Dialog>
            </div>

            {/* Search and Filters */}
            <Card className="card-shadow mb-6">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or nationality..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 pr-9"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                        <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                  </div>

                  {/* Category Filter */}
                  <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v as PlayerCategory | 'all')}>
                    <SelectTrigger className="w-full md:w-40">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Role Filter */}
                  <Select value={roleFilter} onValueChange={v => setRoleFilter(v as PlayerRole | 'all')}>
                    <SelectTrigger className="w-full md:w-40">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {Object.entries(ROLE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Status Filter */}
                  <Select value={statusFilter} onValueChange={v => setStatusFilter(v as 'all' | 'pending' | 'sold' | 'unsold')}>
                    <SelectTrigger className="w-full md:w-36">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                      <SelectItem value="unsold">Unsold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Results count */}
                <div className="mt-3 text-sm text-muted-foreground">
                  Showing {filteredPlayers.length} of {players.length} players
                  {(searchQuery || categoryFilter !== 'all' || roleFilter !== 'all' || statusFilter !== 'all') && (
                    <button 
                      onClick={() => { setSearchQuery(''); setCategoryFilter('all'); setRoleFilter('all'); setStatusFilter('all'); }}
                      className="ml-2 text-primary hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Players Grid */}
            {filteredPlayers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No players found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPlayers.map(p => (
                  <Card key={p.id} className="card-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold">{p.name}</h3>
                          <p className="text-sm text-muted-foreground">{p.nationality} • {p.age}y</p>
                        </div>
                        <CategoryBadge category={p.category} />
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{ROLE_LABELS[p.player_role]} • {p.auction_status}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditingPlayer(p)}><Edit className="w-3 h-3" /></Button>
                        <Button size="sm" variant="destructive" onClick={() => deletePlayer(p.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Edit Player Dialog */}
            <Dialog open={!!editingPlayer} onOpenChange={() => setEditingPlayer(null)}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Edit Player</DialogTitle></DialogHeader>
                {editingPlayer && (
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Name</Label><Input value={editingPlayer.name} onChange={e => setEditingPlayer({...editingPlayer, name: e.target.value})} /></div>
                    <div><Label>Age</Label><Input type="number" value={editingPlayer.age} onChange={e => setEditingPlayer({...editingPlayer, age: +e.target.value})} /></div>
                    <div><Label>Nationality</Label><Input value={editingPlayer.nationality} onChange={e => setEditingPlayer({...editingPlayer, nationality: e.target.value})} /></div>
                    <div><Label>Category</Label>
                      <Select value={editingPlayer.category} onValueChange={v => setEditingPlayer({...editingPlayer, category: v as PlayerCategory})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(CATEGORY_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Role</Label>
                      <Select value={editingPlayer.player_role} onValueChange={v => setEditingPlayer({...editingPlayer, player_role: v as PlayerRole})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(ROLE_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Base Price</Label><Input type="number" value={editingPlayer.base_price || 0} onChange={e => setEditingPlayer({...editingPlayer, base_price: +e.target.value})} /></div>
                    <div><Label>Matches</Label><Input type="number" value={editingPlayer.total_matches || 0} onChange={e => setEditingPlayer({...editingPlayer, total_matches: +e.target.value})} /></div>
                    <div><Label>Runs</Label><Input type="number" value={editingPlayer.total_runs || 0} onChange={e => setEditingPlayer({...editingPlayer, total_runs: +e.target.value})} /></div>
                    <div><Label>Wickets</Label><Input type="number" value={editingPlayer.wickets || 0} onChange={e => setEditingPlayer({...editingPlayer, wickets: +e.target.value})} /></div>
                    <div><Label>Strike Rate</Label><Input type="number" step="0.01" value={editingPlayer.strike_rate || 0} onChange={e => setEditingPlayer({...editingPlayer, strike_rate: +e.target.value})} /></div>
                    <div className="col-span-2"><Label>Profile Picture URL</Label><Input value={editingPlayer.profile_picture_url || ''} onChange={e => setEditingPlayer({...editingPlayer, profile_picture_url: e.target.value})} /></div>
                  </div>
                )}
                <Button onClick={updatePlayer} className="w-full mt-4 gradient-gold">Save Changes</Button>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* OWNERS TAB */}
          <TabsContent value="owners">
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-semibold">Manage Owners</h2>
              <Dialog open={ownerDialogOpen} onOpenChange={setOwnerDialogOpen}>
                <DialogTrigger asChild><Button className="gradient-gold"><Plus className="w-4 h-4 mr-2" />Add Owner</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add New Owner</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Team Name</Label><Input value={newOwner.team_name} onChange={e => setNewOwner({...newOwner, team_name: e.target.value})} /></div>
                    <div><Label>Total Points</Label><Input type="number" value={newOwner.total_points} onChange={e => setNewOwner({...newOwner, total_points: +e.target.value})} /></div>
                    <div><Label>Team Logo URL</Label><Input value={newOwner.team_logo_url} onChange={e => setNewOwner({...newOwner, team_logo_url: e.target.value})} /></div>
                  </div>
                  <Button onClick={addOwner} className="w-full mt-4 gradient-gold">Add Owner</Button>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {owners.map(o => (
                <Card key={o.id} className="card-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      {o.team_logo_url && <img src={o.team_logo_url} alt={o.team_name} className="w-10 h-10 rounded-full object-cover" />}
                      <h3 className="font-semibold">{o.team_name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">Points: {o.remaining_points.toLocaleString()} / {o.total_points.toLocaleString()}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditingOwner(o)}><Edit className="w-3 h-3" /></Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteOwner(o.id)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Edit Owner Dialog */}
            <Dialog open={!!editingOwner} onOpenChange={() => setEditingOwner(null)}>
              <DialogContent>
                <DialogHeader><DialogTitle>Edit Owner</DialogTitle></DialogHeader>
                {editingOwner && (
                  <div className="space-y-4">
                    <div><Label>Team Name</Label><Input value={editingOwner.team_name} onChange={e => setEditingOwner({...editingOwner, team_name: e.target.value})} /></div>
                    <div><Label>Total Points</Label><Input type="number" value={editingOwner.total_points} onChange={e => setEditingOwner({...editingOwner, total_points: +e.target.value})} /></div>
                    <div><Label>Team Logo URL</Label><Input value={editingOwner.team_logo_url || ''} onChange={e => setEditingOwner({...editingOwner, team_logo_url: e.target.value})} /></div>
                  </div>
                )}
                <Button onClick={updateOwner} className="w-full mt-4 gradient-gold">Save Changes</Button>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
