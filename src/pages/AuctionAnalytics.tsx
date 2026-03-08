import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, ScatterChart, Scatter,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { BarChart3, PieChart as PieIcon, TrendingUp, Target, Users, DollarSign, Activity, Trophy, Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface TeamPlayer {
  owner_id: string;
  player_id: string;
  bought_price: number;
  player: {
    name: string;
    category: string;
    base_price: number | null;
    player_role: string;
    age: number;
  };
}

interface Owner {
  id: string;
  team_name: string;
  total_points: number;
  remaining_points: number;
}

interface Bid {
  id: string;
  player_id: string;
  owner_id: string;
  bid_amount: number;
  created_at: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  platinum: '#E5C76B',
  gold: '#F59E0B',
  silver: '#94A3B8',
  emerging: '#34D399',
};

const TEAM_COLORS = [
  'hsl(var(--primary))',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#06B6D4',
  '#EC4899',
  '#10B981',
  '#F97316',
];

const CHART_COLORS = ['#E5C76B', '#F59E0B', '#94A3B8', '#34D399', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899'];

export default function AuctionAnalytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    const [tpRes, ownersRes, bidsRes] = await Promise.all([
      supabase.from('team_players').select('*, player:players(name, category, base_price, player_role, age)'),
      supabase.from('owners').select('*'),
      supabase.from('bids').select('*').order('created_at', { ascending: true }),
    ]);

    if (tpRes.data) setTeamPlayers(tpRes.data as any);
    if (ownersRes.data) setOwners(ownersRes.data as Owner[]);
    if (bidsRes.data) setBids(bidsRes.data as Bid[]);
    setLoading(false);
  };

  // === Computed Data ===

  // 1. Spending per owner
  const spendingByOwner = owners.map((owner, i) => {
    const spent = owner.total_points - owner.remaining_points;
    const playerCount = teamPlayers.filter(tp => tp.owner_id === owner.id).length;
    return {
      name: owner.team_name,
      spent,
      remaining: owner.remaining_points,
      players: playerCount,
      fill: TEAM_COLORS[i % TEAM_COLORS.length],
    };
  }).sort((a, b) => b.spent - a.spent);

  // 2. Category-wise spending
  const categorySpending = ['platinum', 'gold', 'silver', 'emerging'].map(cat => {
    const catPlayers = teamPlayers.filter(tp => tp.player?.category === cat);
    const totalSpent = catPlayers.reduce((sum, tp) => sum + tp.bought_price, 0);
    const avgPrice = catPlayers.length > 0 ? Math.round(totalSpent / catPlayers.length) : 0;
    const totalBase = catPlayers.reduce((sum, tp) => sum + (tp.player?.base_price || 0), 0);
    return {
      name: cat.charAt(0).toUpperCase() + cat.slice(1),
      category: cat,
      totalSpent,
      avgPrice,
      playerCount: catPlayers.length,
      avgBase: catPlayers.length > 0 ? Math.round(totalBase / catPlayers.length) : 0,
      fill: CATEGORY_COLORS[cat],
    };
  });

  // 3. Bid frequency over time (group by minute)
  const bidFrequency = (() => {
    if (bids.length === 0) return [];
    const grouped: Record<string, number> = {};
    bids.forEach(bid => {
      const date = new Date(bid.created_at!);
      const key = `${date.toLocaleDateString()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
      grouped[key] = (grouped[key] || 0) + 1;
    });
    return Object.entries(grouped).map(([time, count]) => ({ time, bids: count }));
  })();

  // 4. Player valuation vs actual price
  const valuationComparison = teamPlayers
    .filter(tp => tp.player?.base_price)
    .map(tp => ({
      name: tp.player.name,
      basePrice: tp.player.base_price || 0,
      boughtPrice: tp.bought_price,
      premium: tp.bought_price - (tp.player.base_price || 0),
      premiumPct: tp.player.base_price ? Math.round(((tp.bought_price - tp.player.base_price) / tp.player.base_price) * 100) : 0,
      category: tp.player.category,
    }))
    .sort((a, b) => b.premiumPct - a.premiumPct);

  // 5. Bid war intensity per player
  const bidWarIntensity = (() => {
    const playerBids: Record<string, { count: number; maxBid: number; playerName: string }> = {};
    bids.forEach(bid => {
      if (!playerBids[bid.player_id]) {
        const tp = teamPlayers.find(tp => tp.player_id === bid.player_id);
        playerBids[bid.player_id] = { count: 0, maxBid: 0, playerName: tp?.player?.name || 'Unknown' };
      }
      playerBids[bid.player_id].count++;
      playerBids[bid.player_id].maxBid = Math.max(playerBids[bid.player_id].maxBid, bid.bid_amount);
    });
    return Object.values(playerBids).sort((a, b) => b.count - a.count).slice(0, 10);
  })();

  // 6. Role distribution per team
  const roleDistribution = owners.map((owner, i) => {
    const players = teamPlayers.filter(tp => tp.owner_id === owner.id);
    return {
      team: owner.team_name,
      batsman: players.filter(p => p.player?.player_role === 'batsman').length,
      bowler: players.filter(p => p.player?.player_role === 'bowler').length,
      all_rounder: players.filter(p => p.player?.player_role === 'all_rounder').length,
      wicket_keeper: players.filter(p => p.player?.player_role === 'wicket_keeper').length,
      fill: TEAM_COLORS[i % TEAM_COLORS.length],
    };
  });

  // Summary stats
  const totalSpent = owners.reduce((sum, o) => sum + (o.total_points - o.remaining_points), 0);
  const totalPlayers = teamPlayers.length;
  const totalBids = bids.length;
  const avgBidPerPlayer = totalPlayers > 0 ? Math.round(totalBids / totalPlayers) : 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-lg">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-xs text-muted-foreground">
            {p.name}: <span className="font-semibold text-foreground">{p.value?.toLocaleString()}</span>
          </p>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-20 text-center">
          <Activity className="w-12 h-12 mx-auto animate-spin text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-8 space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary" />
            Auction Analytics
          </h1>
          <p className="text-muted-foreground mt-1">Deep insights into auction spending, bidding patterns, and player valuations</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="card-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalSpent.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total Spent</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-accent/10">
                  <Users className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalPlayers}</p>
                  <p className="text-xs text-muted-foreground">Players Sold</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-destructive/10">
                  <Activity className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalBids}</p>
                  <p className="text-xs text-muted-foreground">Total Bids</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-secondary/50">
                  <Target className="w-5 h-5 text-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{avgBidPerPlayer}</p>
                  <p className="text-xs text-muted-foreground">Avg Bids/Player</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="spending" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
            <TabsTrigger value="spending" className="gap-2 py-2.5">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Spending</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2 py-2.5">
              <PieIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Categories</span>
            </TabsTrigger>
            <TabsTrigger value="bidding" className="gap-2 py-2.5">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Bid Activity</span>
            </TabsTrigger>
            <TabsTrigger value="valuation" className="gap-2 py-2.5">
              <Target className="w-4 h-4" />
              <span className="hidden sm:inline">Valuations</span>
            </TabsTrigger>
          </TabsList>

          {/* Spending Tab */}
          <TabsContent value="spending" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="card-shadow">
                <CardHeader>
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-primary" />
                    Spending by Team
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={spendingByOwner} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="spent" name="Spent" radius={[0, 6, 6, 0]}>
                        {spendingByOwner.map((entry, i) => (
                          <Cell key={i} fill={TEAM_COLORS[i % TEAM_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="card-shadow">
                <CardHeader>
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Budget Utilization
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={spendingByOwner}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="spent" name="Spent" stackId="a" fill="#E5C76B" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="remaining" name="Remaining" stackId="a" fill="hsl(var(--muted))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Role Distribution */}
            {roleDistribution.length > 0 && (
              <Card className="card-shadow">
                <CardHeader>
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    Squad Composition by Role
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={roleDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="team" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="batsman" name="Batsman" fill="#E5C76B" />
                      <Bar dataKey="bowler" name="Bowler" fill="#EF4444" />
                      <Bar dataKey="all_rounder" name="All-Rounder" fill="#8B5CF6" />
                      <Bar dataKey="wicket_keeper" name="Keeper" fill="#06B6D4" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="card-shadow">
                <CardHeader>
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    <PieIcon className="w-5 h-5 text-primary" />
                    Spending by Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categorySpending.filter(c => c.totalSpent > 0)}
                        cx="50%" cy="50%"
                        innerRadius={60} outerRadius={110}
                        dataKey="totalSpent"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {categorySpending.filter(c => c.totalSpent > 0).map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="card-shadow">
                <CardHeader>
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Avg Price vs Base Price
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={categorySpending}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="avgBase" name="Avg Base Price" fill="hsl(var(--muted))" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="avgPrice" name="Avg Bought Price" fill="#E5C76B" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Category player counts */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categorySpending.map(cat => (
                <Card key={cat.category} className="card-shadow">
                  <CardContent className="pt-6 text-center">
                    <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ backgroundColor: cat.fill }} />
                    <p className="font-display font-bold text-lg">{cat.playerCount}</p>
                    <p className="text-xs text-muted-foreground">{cat.name} Players</p>
                    <p className="text-sm font-semibold mt-1">{cat.totalSpent.toLocaleString()} pts</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Bidding Activity Tab */}
          <TabsContent value="bidding" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="card-shadow">
                <CardHeader>
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    Bid Frequency Over Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={bidFrequency}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="time" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="bids" name="Bids" stroke="#E5C76B" strokeWidth={2} dot={{ fill: '#E5C76B', r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="card-shadow">
                <CardHeader>
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Most Contested Players
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={bidWarIntensity} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                      <YAxis dataKey="playerName" type="category" width={120} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" name="Total Bids" fill="#E5C76B" radius={[0, 6, 6, 0]}>
                        {bidWarIntensity.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Bids per team */}
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Bidding Activity per Team
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={owners.map((owner, i) => ({
                    name: owner.team_name,
                    bids: bids.filter(b => b.owner_id === owner.id).length,
                    won: teamPlayers.filter(tp => tp.owner_id === owner.id).length,
                    fill: TEAM_COLORS[i % TEAM_COLORS.length],
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="bids" name="Total Bids" fill="#E5C76B" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="won" name="Players Won" fill="#34D399" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Valuation Tab */}
          <TabsContent value="valuation" className="space-y-6">
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Base Price vs Bought Price
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={valuationComparison.slice(0, 15)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} angle={-35} textAnchor="end" height={80} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="basePrice" name="Base Price" fill="hsl(var(--muted))" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="boughtPrice" name="Bought Price" fill="#E5C76B" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Premium % table */}
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Price Premium Rankings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {valuationComparison.map((player, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-6">#{i + 1}</span>
                        <div>
                          <p className="font-medium text-sm">{player.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{player.category}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{player.boughtPrice.toLocaleString()} pts</p>
                        <p className={`text-xs font-medium ${player.premiumPct > 0 ? 'text-destructive' : 'text-accent'}`}>
                          {player.premiumPct > 0 ? '+' : ''}{player.premiumPct}% premium
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
