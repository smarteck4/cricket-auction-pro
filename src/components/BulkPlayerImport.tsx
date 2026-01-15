import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CategorySetting, PlayerCategory, PlayerRole, BattingHand, CATEGORY_LABELS, ROLE_LABELS } from '@/lib/types';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface BulkPlayerImportProps {
  categorySettings: CategorySetting[];
  onImportComplete: () => void;
}

interface PreviewPlayer {
  name: string;
  age: number;
  nationality: string;
  category: PlayerCategory;
  player_role: PlayerRole;
  batting_hand: BattingHand;
  total_matches: number;
  total_runs: number;
  highest_score: number;
  strike_rate: number;
  wickets: number;
  bowling_average: number;
  economy_rate: number;
  best_bowling: string;
  profile_picture_url: string;
  base_price: number;
  isValid: boolean;
  errors: string[];
}

const VALID_CATEGORIES: PlayerCategory[] = ['platinum', 'gold', 'silver', 'emerging'];
const VALID_ROLES: PlayerRole[] = ['batsman', 'bowler', 'all_rounder', 'wicket_keeper'];
const VALID_HANDS: BattingHand[] = ['left', 'right'];

export function BulkPlayerImport({ categorySettings, onImportComplete }: BulkPlayerImportProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewPlayer[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const template = [
      {
        name: 'John Doe',
        age: 25,
        nationality: 'India',
        category: 'gold',
        player_role: 'batsman',
        batting_hand: 'right',
        total_matches: 50,
        total_runs: 1500,
        highest_score: 120,
        strike_rate: 135.5,
        wickets: 0,
        bowling_average: 0,
        economy_rate: 0,
        best_bowling: '',
        profile_picture_url: '',
      },
      {
        name: 'Jane Smith',
        age: 22,
        nationality: 'Australia',
        category: 'platinum',
        player_role: 'bowler',
        batting_hand: 'left',
        total_matches: 80,
        total_runs: 200,
        highest_score: 35,
        strike_rate: 95.5,
        wickets: 120,
        bowling_average: 22.5,
        economy_rate: 6.8,
        best_bowling: '5/23',
        profile_picture_url: '',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Players');
    XLSX.writeFile(wb, 'player_import_template.xlsx');
  };

  const validatePlayer = (row: any): PreviewPlayer => {
    const errors: string[] = [];
    
    // Normalize and validate category
    let category = String(row.category || '').toLowerCase().trim() as PlayerCategory;
    if (!VALID_CATEGORIES.includes(category)) {
      errors.push(`Invalid category: ${row.category}. Use: ${VALID_CATEGORIES.join(', ')}`);
      category = 'gold';
    }
    
    // Normalize and validate role
    let player_role = String(row.player_role || '').toLowerCase().trim().replace('-', '_').replace(' ', '_') as PlayerRole;
    if (!VALID_ROLES.includes(player_role)) {
      errors.push(`Invalid role: ${row.player_role}. Use: ${VALID_ROLES.join(', ')}`);
      player_role = 'batsman';
    }
    
    // Normalize and validate batting hand
    let batting_hand = String(row.batting_hand || '').toLowerCase().trim() as BattingHand;
    if (!VALID_HANDS.includes(batting_hand)) {
      errors.push(`Invalid batting hand: ${row.batting_hand}. Use: left, right`);
      batting_hand = 'right';
    }
    
    // Validate required fields
    const name = String(row.name || '').trim();
    if (!name) {
      errors.push('Name is required');
    }
    
    const nationality = String(row.nationality || '').trim();
    if (!nationality) {
      errors.push('Nationality is required');
    }
    
    const age = Number(row.age) || 0;
    if (age < 15 || age > 50) {
      errors.push(`Invalid age: ${age}. Must be between 15-50`);
    }
    
    // Get base price from category settings
    const basePrice = categorySettings.find(c => c.category === category)?.base_price || 100;
    
    return {
      name,
      age,
      nationality,
      category,
      player_role,
      batting_hand,
      total_matches: Number(row.total_matches) || 0,
      total_runs: Number(row.total_runs) || 0,
      highest_score: Number(row.highest_score) || 0,
      strike_rate: Number(row.strike_rate) || 0,
      wickets: Number(row.wickets) || 0,
      bowling_average: Number(row.bowling_average) || 0,
      economy_rate: Number(row.economy_rate) || 0,
      best_bowling: String(row.best_bowling || ''),
      profile_picture_url: String(row.profile_picture_url || ''),
      base_price: basePrice,
      isValid: errors.length === 0,
      errors,
    };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          toast({ title: 'Empty file', description: 'The uploaded file contains no data', variant: 'destructive' });
          return;
        }

        const validated = jsonData.map(validatePlayer);
        setPreviewData(validated);
        setDialogOpen(true);
      } catch (error) {
        toast({ title: 'Error parsing file', description: 'Please ensure the file is a valid Excel or CSV file', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const importPlayers = async () => {
    const validPlayers = previewData.filter(p => p.isValid);
    if (validPlayers.length === 0) {
      toast({ title: 'No valid players', description: 'Please fix all errors before importing', variant: 'destructive' });
      return;
    }

    setImporting(true);
    
    const playersToInsert = validPlayers.map(({ isValid, errors, ...player }) => player);
    
    const { error } = await supabase.from('players').insert(playersToInsert);
    
    if (error) {
      toast({ title: 'Import failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Import successful!', description: `${validPlayers.length} players imported` });
      setDialogOpen(false);
      setPreviewData([]);
      onImportComplete();
    }
    
    setImporting(false);
  };

  const validCount = previewData.filter(p => p.isValid).length;
  const invalidCount = previewData.filter(p => !p.isValid).length;

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx,.xls,.csv"
        className="hidden"
      />
      
      <div className="flex gap-2">
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="w-4 h-4 mr-2" />Template
        </Button>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />Import Excel/CSV
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-4">
              <span>Preview Import Data</span>
              <div className="flex gap-2 text-sm font-normal">
                <Badge variant="default" className="bg-accent">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {validCount} valid
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive">
                    <XCircle className="w-3 h-3 mr-1" />
                    {invalidCount} with errors
                  </Badge>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Status</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Batting</TableHead>
                  <TableHead>Base Price</TableHead>
                  <TableHead>Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((player, index) => (
                  <TableRow key={index} className={!player.isValid ? 'bg-destructive/5' : ''}>
                    <TableCell>
                      {player.isValid ? (
                        <CheckCircle className="w-5 h-5 text-accent" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{player.name || '-'}</TableCell>
                    <TableCell>{player.age}</TableCell>
                    <TableCell>{player.nationality || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{CATEGORY_LABELS[player.category]}</Badge>
                    </TableCell>
                    <TableCell>{ROLE_LABELS[player.player_role]}</TableCell>
                    <TableCell className="capitalize">{player.batting_hand}</TableCell>
                    <TableCell>{player.base_price}</TableCell>
                    <TableCell className="max-w-[200px]">
                      {player.errors.length > 0 && (
                        <span className="text-xs text-destructive">
                          {player.errors.join('; ')}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {validCount} of {previewData.length} players will be imported
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={importPlayers} disabled={importing || validCount === 0} className="gradient-gold">
                <Upload className="w-4 h-4 mr-2" />
                {importing ? 'Importing...' : `Import ${validCount} Players`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
