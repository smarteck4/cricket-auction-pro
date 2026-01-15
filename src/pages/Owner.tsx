import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header';
import { CategoryBadge } from '@/components/CategoryBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TeamPlayer, Player, MIN_TEAM_REQUIREMENTS, ROLE_LABELS } from '@/lib/types';
import { Users, Download, Trophy } from 'lucide-react';
import { PlayerListExport } from '@/components/PlayerListExport';
import * as XLSX from 'xlsx';

export default function Owner() {
  const { user, role, owner } = useAuth();
  const navigate = useNavigate();
  const [teamPlayers, setTeamPlayers] = useState<(TeamPlayer & { player: Player })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || role !== 'owner' || !owner) {
      navigate('/');
      return;
    }
    fetchTeam();
  }, [user, role, owner, navigate]);

  const fetchTeam = async () => {
    if (!owner) return;
    const { data } = await supabase
      .from('team_players')
      .select('*, player:players(*)')
      .eq('owner_id', owner.id);
    if (data) setTeamPlayers(data as any);
    setLoading(false);
  };

  const exportToExcel = () => {
    const data = teamPlayers.map(tp => ({
      Name: tp.player.name,
      Category: tp.player.category,
      Role: ROLE_LABELS[tp.player.player_role],
      Age: tp.player.age,
      Nationality: tp.player.nationality,
      'Bought Price': tp.bought_price,
      Matches: tp.player.total_matches,
      Runs: tp.player.total_runs,
      Wickets: tp.player.wickets,
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Team');
    XLSX.writeFile(wb, `${owner?.team_name || 'team'}_squad.xlsx`);
  };

  const getCategoryCount = (cat: string) => teamPlayers.filter(tp => tp.player.category === cat).length;

  if (loading) return <div className="min-h-screen bg-background"><Header /><div className="container py-20 text-center">Loading...</div></div>;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold">{owner?.team_name}</h1>
            <p className="text-muted-foreground">Your squad • {teamPlayers.length} players</p>
          </div>
          <div className="flex gap-4">
            <Card className="card-shadow">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Remaining Points</p>
                <p className="font-display text-2xl font-bold text-gradient-gold">{owner?.remaining_points.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Button onClick={exportToExcel} className="gradient-gold">
              <Download className="w-4 h-4 mr-2" />Export to Excel
            </Button>
          </div>
        </div>

        {/* Player List Export */}
        <div className="mb-8">
          <PlayerListExport teamName={owner?.team_name} />
        </div>

        {/* Requirements */}
        <Card className="card-shadow mb-8">
          <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5" />Team Requirements</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4 text-center">
              <div className={teamPlayers.length >= MIN_TEAM_REQUIREMENTS.total ? 'text-accent' : ''}>
                <p className="text-2xl font-bold">{teamPlayers.length}/{MIN_TEAM_REQUIREMENTS.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
              {(['platinum', 'gold', 'silver', 'emerging'] as const).map(cat => (
                <div key={cat} className={getCategoryCount(cat) >= MIN_TEAM_REQUIREMENTS[cat] ? 'text-accent' : ''}>
                  <p className="text-2xl font-bold">{getCategoryCount(cat)}/{MIN_TEAM_REQUIREMENTS[cat]}</p>
                  <CategoryBadge category={cat} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Players Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamPlayers.map(tp => (
            <Card key={tp.id} className="card-shadow">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {tp.player.profile_picture_url ? (
                    <img src={tp.player.profile_picture_url} alt={tp.player.name} className="w-16 h-16 rounded-lg object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center"><Users className="w-8 h-8 text-muted-foreground" /></div>
                  )}
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold">{tp.player.name}</h3>
                      <CategoryBadge category={tp.player.category} />
                    </div>
                    <p className="text-sm text-muted-foreground">{ROLE_LABELS[tp.player.player_role]}</p>
                    <p className="text-sm font-medium text-primary mt-1">Bought: {tp.bought_price} pts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {teamPlayers.length === 0 && (
          <div className="text-center py-20">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No players yet</h3>
            <p className="text-muted-foreground">Go to the auction to bid on players!</p>
          </div>
        )}
      </main>
    </div>
  );
}
