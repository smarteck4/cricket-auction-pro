import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header';
import { CategoryBadge } from '@/components/CategoryBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Player, Owner, CategorySetting, PlayerCategory, PlayerRole, BattingHand, CATEGORY_LABELS, ROLE_LABELS } from '@/lib/types';
import { Plus, Play, Square, Users, Settings, Trash2, Edit, Gavel } from 'lucide-react';

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
  
  const [newPlayer, setNewPlayer] = useState({
    name: '', age: 20, nationality: '', category: 'gold' as PlayerCategory,
    player_role: 'batsman' as PlayerRole, batting_hand: 'right' as BattingHand,
    total_matches: 0, total_runs: 0, highest_score: 0, strike_rate: 0,
    wickets: 0, bowling_average: 0, economy_rate: 0, best_bowling: '', profile_picture_url: ''
  });
  
  const [newOwner, setNewOwner] = useState({ team_name: '', total_points: 10000, team_logo_url: '' });

  useEffect(() => {
    if (!user || role !== 'admin') {
      navigate('/');
      return;
    }
    fetchData();
  }, [user, role, navigate]);

  const fetchData = async () => {
    const [playersRes, ownersRes, settingsRes] = await Promise.all([
      supabase.from('players').select('*').order('category'),
      supabase.from('owners').select('*'),
      supabase.from('category_settings').select('*'),
    ]);
    
    if (playersRes.data) setPlayers(playersRes.data as Player[]);
    if (ownersRes.data) setOwners(ownersRes.data as Owner[]);
    if (settingsRes.data) setCategorySettings(settingsRes.data as CategorySetting[]);
    setLoading(false);
  };

  const addPlayer = async () => {
    const basePrice = categorySettings.find(c => c.category === newPlayer.category)?.base_price || 100;
    const { error } = await supabase.from('players').insert({ ...newPlayer, base_price: basePrice });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Player added!' });
      setPlayerDialogOpen(false);
      fetchData();
    }
  };

  const deletePlayer = async (id: string) => {
    await supabase.from('players').delete().eq('id', id);
    fetchData();
  };

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
      fetchData();
    }
  };

  const startAuction = async (player: Player) => {
    const { data: existing } = await supabase.from('current_auction').select('id').limit(1);
    
    if (existing && existing.length > 0) {
      await supabase.from('current_auction').update({
        player_id: player.id,
        current_bid: player.base_price || 100,
        current_bidder_id: null,
        is_active: true,
        started_at: new Date().toISOString(),
      }).eq('id', existing[0].id);
    } else {
      await supabase.from('current_auction').insert({
        player_id: player.id,
        current_bid: player.base_price || 100,
        is_active: true,
        started_at: new Date().toISOString(),
      });
    }
    
    await supabase.from('players').update({ auction_status: 'active' }).eq('id', player.id);
    toast({ title: 'Auction started!', description: `Bidding open for ${player.name}` });
  };

  const endAuction = async () => {
    const { data: auction } = await supabase.from('current_auction').select('*').limit(1).single();
    if (!auction) return;

    if (auction.current_bidder_id && auction.player_id) {
      // Player sold
      await supabase.from('team_players').insert({
        owner_id: auction.current_bidder_id,
        player_id: auction.player_id,
        bought_price: auction.current_bid,
      });
      
      const { data: ownerData } = await supabase.from('owners').select('remaining_points').eq('id', auction.current_bidder_id).single();
      if (ownerData) {
        await supabase.from('owners').update({
          remaining_points: ownerData.remaining_points - auction.current_bid
        }).eq('id', auction.current_bidder_id);
      }
      
      await supabase.from('players').update({ auction_status: 'sold' }).eq('id', auction.player_id);
      toast({ title: 'Player sold!' });
    } else if (auction.player_id) {
      await supabase.from('players').update({ auction_status: 'unsold' }).eq('id', auction.player_id);
      toast({ title: 'Player unsold' });
    }
    
    await supabase.from('current_auction').update({ is_active: false, player_id: null, current_bidder_id: null, current_bid: 0 }).eq('id', auction.id);
    fetchData();
  };

  if (loading) return <div className="min-h-screen bg-background"><Header /><div className="container py-20 text-center">Loading...</div></div>;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <h1 className="font-display text-3xl font-bold mb-8">Admin Panel</h1>
        
        <Tabs defaultValue="players">
          <TabsList className="mb-6">
            <TabsTrigger value="players"><Users className="w-4 h-4 mr-2" />Players</TabsTrigger>
            <TabsTrigger value="owners"><Users className="w-4 h-4 mr-2" />Owners</TabsTrigger>
            <TabsTrigger value="auction"><Gavel className="w-4 h-4 mr-2" />Auction Control</TabsTrigger>
          </TabsList>

          <TabsContent value="players">
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-semibold">Players ({players.length})</h2>
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
                    <div><Label>Wickets</Label><Input type="number" value={newPlayer.wickets} onChange={e => setNewPlayer({...newPlayer, wickets: +e.target.value})} /></div>
                    <div><Label>Economy</Label><Input type="number" step="0.01" value={newPlayer.economy_rate} onChange={e => setNewPlayer({...newPlayer, economy_rate: +e.target.value})} /></div>
                    <div className="col-span-2"><Label>Profile Picture URL</Label><Input value={newPlayer.profile_picture_url} onChange={e => setNewPlayer({...newPlayer, profile_picture_url: e.target.value})} /></div>
                  </div>
                  <Button onClick={addPlayer} className="w-full mt-4 gradient-gold">Add Player</Button>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {players.map(p => (
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
                      {p.auction_status === 'pending' && <Button size="sm" onClick={() => startAuction(p)}><Play className="w-3 h-3 mr-1" />Start</Button>}
                      <Button size="sm" variant="destructive" onClick={() => deletePlayer(p.id)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="owners">
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-semibold">Owners ({owners.length})</h2>
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
                    <h3 className="font-semibold">{o.team_name}</h3>
                    <p className="text-sm text-muted-foreground">Points: {o.remaining_points.toLocaleString()} / {o.total_points.toLocaleString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="auction">
            <Card className="card-shadow">
              <CardHeader><CardTitle>Auction Control</CardTitle></CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={endAuction}><Square className="w-4 h-4 mr-2" />End Current Auction</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
