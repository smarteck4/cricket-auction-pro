import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Player, PlayerCategory, CATEGORY_LABELS, ROLE_LABELS } from '@/lib/types';
import { Download, FileSpreadsheet, Users } from 'lucide-react';
import * as XLSX from 'xlsx';

interface PlayerListExportProps {
  teamName?: string;
}

export function PlayerListExport({ teamName }: PlayerListExportProps) {
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<PlayerCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'sold' | 'unsold'>('all');

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    const { data } = await supabase.from('players').select('*').order('category');
    if (data) setPlayers(data as Player[]);
    setLoading(false);
  };

  const getFilteredPlayers = () => {
    return players.filter(p => {
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || p.auction_status === statusFilter;
      return matchesCategory && matchesStatus;
    });
  };

  const exportToExcel = () => {
    setExporting(true);
    const filteredPlayers = getFilteredPlayers();
    
    if (filteredPlayers.length === 0) {
      toast({ title: 'No players to export', description: 'No players match the selected filters', variant: 'destructive' });
      setExporting(false);
      return;
    }

    const data = filteredPlayers.map(p => ({
      Name: p.name,
      Age: p.age,
      Nationality: p.nationality,
      Category: CATEGORY_LABELS[p.category],
      Role: ROLE_LABELS[p.player_role],
      'Batting Hand': p.batting_hand === 'left' ? 'Left' : 'Right',
      'Base Price': p.base_price,
      Status: p.auction_status.charAt(0).toUpperCase() + p.auction_status.slice(1),
      Matches: p.total_matches,
      Runs: p.total_runs,
      'Highest Score': p.highest_score,
      'Strike Rate': p.strike_rate,
      Wickets: p.wickets,
      'Best Bowling': p.best_bowling || '-',
      'Bowling Average': p.bowling_average,
      'Economy Rate': p.economy_rate,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Players');
    
    const filename = `players_${categoryFilter !== 'all' ? categoryFilter + '_' : ''}${statusFilter !== 'all' ? statusFilter + '_' : ''}${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    
    toast({ title: 'Export successful!', description: `${filteredPlayers.length} players exported` });
    setExporting(false);
  };

  const exportToCSV = () => {
    setExporting(true);
    const filteredPlayers = getFilteredPlayers();
    
    if (filteredPlayers.length === 0) {
      toast({ title: 'No players to export', description: 'No players match the selected filters', variant: 'destructive' });
      setExporting(false);
      return;
    }

    const data = filteredPlayers.map(p => ({
      Name: p.name,
      Age: p.age,
      Nationality: p.nationality,
      Category: CATEGORY_LABELS[p.category],
      Role: ROLE_LABELS[p.player_role],
      'Batting Hand': p.batting_hand === 'left' ? 'Left' : 'Right',
      'Base Price': p.base_price,
      Status: p.auction_status.charAt(0).toUpperCase() + p.auction_status.slice(1),
      Matches: p.total_matches,
      Runs: p.total_runs,
      'Highest Score': p.highest_score,
      'Strike Rate': p.strike_rate,
      Wickets: p.wickets,
      'Best Bowling': p.best_bowling || '-',
      'Bowling Average': p.bowling_average,
      'Economy Rate': p.economy_rate,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const filename = `players_${categoryFilter !== 'all' ? categoryFilter + '_' : ''}${statusFilter !== 'all' ? statusFilter + '_' : ''}${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', filename);
    link.click();
    URL.revokeObjectURL(url);
    
    toast({ title: 'Export successful!', description: `${filteredPlayers.length} players exported` });
    setExporting(false);
  };

  const filteredCount = getFilteredPlayers().length;

  if (loading) {
    return (
      <Card className="card-shadow">
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading players...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Export Player List
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v as PlayerCategory | 'all')}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as 'all' | 'pending' | 'sold' | 'unsold')}>
            <SelectTrigger className="w-full sm:w-32">
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

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Users className="w-4 h-4" />
            {filteredCount} players match filters
          </p>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={exportToCSV} 
              disabled={exporting || filteredCount === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button 
              size="sm"
              onClick={exportToExcel} 
              disabled={exporting || filteredCount === 0}
              className="gradient-gold"
            >
              <Download className="w-4 h-4 mr-2" />
              Excel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
