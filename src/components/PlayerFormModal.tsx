import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlayerCategory, PlayerRole, BattingHand, CATEGORY_LABELS, ROLE_LABELS } from '@/lib/types';
import { Link, Upload } from 'lucide-react';

export interface PlayerFormData {
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
  fifties: number;
  centuries: number;
  profile_picture_url: string;
  base_price?: number | null;
}

interface PlayerFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: PlayerFormData;
  onPlayerChange: (player: PlayerFormData) => void;
  onSubmit: () => void;
  title: string;
  submitLabel: string;
  isSubmitting?: boolean;
  showImageUpload?: boolean;
  onImageFileSelect?: (file: File | null) => void;
  selectedImageFile?: File | null;
}

export function PlayerFormModal({
  open,
  onOpenChange,
  player,
  onPlayerChange,
  onSubmit,
  title,
  submitLabel,
  isSubmitting = false,
  showImageUpload = true,
  onImageFileSelect,
  selectedImageFile,
}: PlayerFormModalProps) {
  const [imageUploadType, setImageUploadType] = useState<'url' | 'file'>('url');

  const update = (fields: Partial<PlayerFormData>) => {
    onPlayerChange({ ...player, ...fields });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          {/* Basic Info */}
          <div><Label>Name</Label><Input value={player.name} onChange={e => update({ name: e.target.value })} /></div>
          <div><Label>Age</Label><Input type="number" value={player.age} onChange={e => update({ age: +e.target.value })} /></div>
          <div><Label>Nationality</Label><Input value={player.nationality} onChange={e => update({ nationality: e.target.value })} /></div>
          <div><Label>Category</Label>
            <Select value={player.category} onValueChange={v => update({ category: v as PlayerCategory })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Role</Label>
            <Select value={player.player_role} onValueChange={v => update({ player_role: v as PlayerRole })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Batting Hand</Label>
            <Select value={player.batting_hand} onValueChange={v => update({ batting_hand: v as BattingHand })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="right">Right</SelectItem>
                <SelectItem value="left">Left</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Base Price (only for edit) */}
          {player.base_price !== undefined && (
            <div><Label>Base Price</Label><Input type="number" value={player.base_price || 0} onChange={e => update({ base_price: +e.target.value })} /></div>
          )}

          {/* Batting Stats */}
          <div className="col-span-2 pt-4 border-t">
            <h4 className="font-medium text-sm text-muted-foreground mb-3">Batting Statistics</h4>
          </div>
          <div><Label>Matches</Label><Input type="number" value={player.total_matches} onChange={e => update({ total_matches: +e.target.value })} /></div>
          <div><Label>Runs</Label><Input type="number" value={player.total_runs} onChange={e => update({ total_runs: +e.target.value })} /></div>
          <div><Label>Highest Score</Label><Input type="number" value={player.highest_score} onChange={e => update({ highest_score: +e.target.value })} /></div>
          <div><Label>Strike Rate</Label><Input type="number" step="0.01" value={player.strike_rate} onChange={e => update({ strike_rate: +e.target.value })} /></div>
          <div><Label>Fifties</Label><Input type="number" value={player.fifties} onChange={e => update({ fifties: +e.target.value })} /></div>
          <div><Label>Centuries</Label><Input type="number" value={player.centuries} onChange={e => update({ centuries: +e.target.value })} /></div>

          {/* Bowling Stats */}
          <div className="col-span-2 pt-4 border-t">
            <h4 className="font-medium text-sm text-muted-foreground mb-3">Bowling Statistics</h4>
          </div>
          <div><Label>Wickets</Label><Input type="number" value={player.wickets} onChange={e => update({ wickets: +e.target.value })} /></div>
          <div><Label>Best Bowling (e.g. 5/23)</Label><Input placeholder="e.g. 5/23" value={player.best_bowling} onChange={e => update({ best_bowling: e.target.value })} /></div>
          <div><Label>Bowling Average</Label><Input type="number" step="0.01" value={player.bowling_average} onChange={e => update({ bowling_average: +e.target.value })} /></div>
          <div><Label>Economy Rate</Label><Input type="number" step="0.01" value={player.economy_rate} onChange={e => update({ economy_rate: +e.target.value })} /></div>

          {/* Profile Image */}
          <div className="col-span-2 pt-4 border-t">
            <h4 className="font-medium text-sm text-muted-foreground mb-3">Profile Image</h4>
            {showImageUpload && onImageFileSelect ? (
              <>
                <div className="flex gap-2 mb-3">
                  <Button type="button" variant={imageUploadType === 'url' ? 'default' : 'outline'} size="sm" onClick={() => setImageUploadType('url')} className="flex-1">
                    <Link className="w-4 h-4 mr-2" />URL
                  </Button>
                  <Button type="button" variant={imageUploadType === 'file' ? 'default' : 'outline'} size="sm" onClick={() => setImageUploadType('file')} className="flex-1">
                    <Upload className="w-4 h-4 mr-2" />Upload
                  </Button>
                </div>
                {imageUploadType === 'url' ? (
                  <Input placeholder="Enter image URL" value={player.profile_picture_url} onChange={e => update({ profile_picture_url: e.target.value })} />
                ) : (
                  <div className="space-y-2">
                    <Input type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; onImageFileSelect(file || null); }} />
                    {selectedImageFile && <p className="text-sm text-muted-foreground">Selected: {selectedImageFile.name}</p>}
                  </div>
                )}
              </>
            ) : (
              <Input placeholder="Enter image URL" value={player.profile_picture_url} onChange={e => update({ profile_picture_url: e.target.value })} />
            )}
          </div>
        </div>
        <Button onClick={onSubmit} className="w-full mt-4 gradient-gold" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
