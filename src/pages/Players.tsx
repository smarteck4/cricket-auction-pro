import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/Header';
import { PlayerCard } from '@/components/PlayerCard';
import { CategoryBadge } from '@/components/CategoryBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Player, PlayerCategory, PlayerRole, ROLE_LABELS, CATEGORY_LABELS } from '@/lib/types';
import { Search, X, User, Target, TrendingUp, Zap, Award, CircleDot } from 'lucide-react';

export default function Players() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'sold' | 'unsold'>('all');
  const [categoryFilter, setCategoryFilter] = useState<PlayerCategory | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<PlayerRole | 'all'>('all');

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('name');

    if (!error && data) {
      setPlayers(data as Player[]);
    }
    setLoading(false);
  };

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      const matchesSearch = 
        player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        player.nationality.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || player.auction_status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || player.category === categoryFilter;
      const matchesRole = roleFilter === 'all' || player.player_role === roleFilter;
      return matchesSearch && matchesStatus && matchesCategory && matchesRole;
    });
  }, [players, searchQuery, statusFilter, categoryFilter, roleFilter]);

  const statusCounts = useMemo(() => ({
    all: players.length,
    pending: players.filter(p => p.auction_status === 'pending').length,
    sold: players.filter(p => p.auction_status === 'sold').length,
    unsold: players.filter(p => p.auction_status === 'unsold').length,
  }), [players]);

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setRoleFilter('all');
  };

  const hasActiveFilters = searchQuery || categoryFilter !== 'all' || roleFilter !== 'all';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold mb-2">Players</h1>
          <p className="text-muted-foreground">Browse all players in the auction pool</p>
        </div>

        {/* Status Tabs */}
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)} className="mb-6">
          <TabsList className="grid w-full max-w-md grid-cols-4">
            <TabsTrigger value="all" className="gap-2">
              All <Badge variant="secondary" className="ml-1">{statusCounts.all}</Badge>
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-2">
              Pending <Badge variant="secondary" className="ml-1">{statusCounts.pending}</Badge>
            </TabsTrigger>
            <TabsTrigger value="sold" className="gap-2">
              Sold <Badge variant="secondary" className="ml-1">{statusCounts.sold}</Badge>
            </TabsTrigger>
            <TabsTrigger value="unsold" className="gap-2">
              Unsold <Badge variant="secondary" className="ml-1">{statusCounts.unsold}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or nationality..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              
              <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as PlayerCategory | 'all')}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="platinum">Platinum</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="silver">Silver</SelectItem>
                  <SelectItem value="emerging">Emerging</SelectItem>
                </SelectContent>
              </Select>

              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as PlayerRole | 'all')}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="batsman">Batsman</SelectItem>
                  <SelectItem value="bowler">Bowler</SelectItem>
                  <SelectItem value="all_rounder">All-Rounder</SelectItem>
                  <SelectItem value="wicket_keeper">Wicket Keeper</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>

            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filteredPlayers.length} of {players.length} players
            </div>
          </CardContent>
        </Card>

        {/* Player Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="h-80 animate-pulse bg-muted" />
            ))}
          </div>
        ) : filteredPlayers.length === 0 ? (
          <Card className="py-16">
            <CardContent className="text-center">
              <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No players found</h3>
              <p className="text-muted-foreground mb-4">Try adjusting your search or filters</p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  Clear all filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPlayers.map((player) => (
              <div key={player.id} className="relative">
                <PlayerCard player={player} onClick={() => setSelectedPlayer(player)} />
                {player.auction_status === 'sold' && (
                  <Badge className="absolute top-3 right-3 bg-green-500">Sold</Badge>
                )}
                {player.auction_status === 'unsold' && (
                  <Badge className="absolute top-3 right-3 bg-destructive">Unsold</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Player Detail Modal */}
      <Dialog open={!!selectedPlayer} onOpenChange={(open) => !open && setSelectedPlayer(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedPlayer && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="font-display text-2xl">{selectedPlayer.name}</span>
                  <CategoryBadge category={selectedPlayer.category} />
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Player Image & Basic Info */}
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="sm:w-48 shrink-0">
                    {selectedPlayer.profile_picture_url ? (
                      <img
                        src={selectedPlayer.profile_picture_url}
                        alt={selectedPlayer.name}
                        className="w-full h-48 sm:h-56 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-full h-48 sm:h-56 bg-muted rounded-lg flex items-center justify-center">
                        <User className="w-16 h-16 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Nationality</p>
                        <p className="font-medium">{selectedPlayer.nationality}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Age</p>
                        <p className="font-medium">{selectedPlayer.age} years</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Role</p>
                        <p className="font-medium">{ROLE_LABELS[selectedPlayer.player_role]}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Batting Hand</p>
                        <p className="font-medium capitalize">{selectedPlayer.batting_hand}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Base Price</p>
                        <p className="font-display text-xl font-bold text-primary">
                          {selectedPlayer.base_price} pts
                        </p>
                      </div>
                      <Badge
                        variant={
                          selectedPlayer.auction_status === 'sold'
                            ? 'default'
                            : selectedPlayer.auction_status === 'unsold'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className={selectedPlayer.auction_status === 'sold' ? 'bg-green-500' : ''}
                      >
                        {selectedPlayer.auction_status?.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Batting Stats */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Batting Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{selectedPlayer.total_matches}</p>
                        <p className="text-xs text-muted-foreground">Matches</p>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{selectedPlayer.total_runs}</p>
                        <p className="text-xs text-muted-foreground">Runs</p>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{selectedPlayer.highest_score}</p>
                        <p className="text-xs text-muted-foreground">Highest Score</p>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{Number(selectedPlayer.strike_rate).toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">Strike Rate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Bowling Stats */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CircleDot className="w-4 h-4" />
                      Bowling Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{selectedPlayer.wickets}</p>
                        <p className="text-xs text-muted-foreground">Wickets</p>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{Number(selectedPlayer.bowling_average).toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">Average</p>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{Number(selectedPlayer.economy_rate).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Economy</p>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{selectedPlayer.best_bowling || '-'}</p>
                        <p className="text-xs text-muted-foreground">Best Bowling</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
