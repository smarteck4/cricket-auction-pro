import { useState, useMemo } from 'react';
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

interface ValidationErrors {
  [key: string]: string;
}

function validate(player: PlayerFormData): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!player.name.trim()) errors.name = 'Name is required';
  else if (player.name.trim().length > 100) errors.name = 'Max 100 characters';

  if (!player.nationality.trim()) errors.nationality = 'Nationality is required';
  else if (player.nationality.trim().length > 100) errors.nationality = 'Max 100 characters';

  if (player.age < 10 || player.age > 60) errors.age = 'Age must be 10–60';

  if (player.total_matches < 0) errors.total_matches = 'Cannot be negative';
  if (player.total_runs < 0) errors.total_runs = 'Cannot be negative';
  if (player.highest_score < 0) errors.highest_score = 'Cannot be negative';
  if (player.strike_rate < 0 || player.strike_rate > 500) errors.strike_rate = 'Must be 0–500';
  if (player.fifties < 0) errors.fifties = 'Cannot be negative';
  if (player.centuries < 0) errors.centuries = 'Cannot be negative';

  if (player.wickets < 0) errors.wickets = 'Cannot be negative';
  if (player.bowling_average < 0) errors.bowling_average = 'Cannot be negative';
  if (player.economy_rate < 0 || player.economy_rate > 30) errors.economy_rate = 'Must be 0–30';
  if (player.best_bowling && !/^\d+\/\d+$/.test(player.best_bowling.trim()) && player.best_bowling.trim() !== '')
    errors.best_bowling = 'Format: W/R (e.g. 5/23)';

  if (player.base_price !== undefined && player.base_price !== null && player.base_price < 0)
    errors.base_price = 'Cannot be negative';

  if (player.profile_picture_url && player.profile_picture_url.trim()) {
    try {
      new URL(player.profile_picture_url.trim());
    } catch {
      errors.profile_picture_url = 'Must be a valid URL';
    }
  }

  return errors;
}

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="text-xs text-destructive mt-1">{error}</p>;
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
  const [showErrors, setShowErrors] = useState(false);

  const errors = useMemo(() => validate(player), [player]);
  const hasErrors = Object.keys(errors).length > 0;

  const update = (fields: Partial<PlayerFormData>) => {
    onPlayerChange({ ...player, ...fields });
  };

  const handleSubmit = () => {
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    onSubmit();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) setShowErrors(false);
    onOpenChange(open);
  };

  const errClass = (field: string) =>
    showErrors && errors[field] ? 'border-destructive' : '';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          {/* Basic Info */}
          <div>
            <Label>Name <span className="text-destructive">*</span></Label>
            <Input className={errClass('name')} value={player.name} onChange={e => update({ name: e.target.value })} maxLength={100} />
            {showErrors && <FieldError error={errors.name} />}
          </div>
          <div>
            <Label>Age <span className="text-destructive">*</span></Label>
            <Input className={errClass('age')} type="number" min={10} max={60} value={player.age} onChange={e => update({ age: +e.target.value })} />
            {showErrors && <FieldError error={errors.age} />}
          </div>
          <div>
            <Label>Nationality <span className="text-destructive">*</span></Label>
            <Input className={errClass('nationality')} value={player.nationality} onChange={e => update({ nationality: e.target.value })} maxLength={100} />
            {showErrors && <FieldError error={errors.nationality} />}
          </div>
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
            <div>
              <Label>Base Price</Label>
              <Input className={errClass('base_price')} type="number" min={0} value={player.base_price || 0} onChange={e => update({ base_price: +e.target.value })} />
              {showErrors && <FieldError error={errors.base_price} />}
            </div>
          )}

          {/* Batting Stats */}
          <div className="col-span-2 pt-4 border-t">
            <h4 className="font-medium text-sm text-muted-foreground mb-3">Batting Statistics</h4>
          </div>
          <div>
            <Label>Matches</Label>
            <Input className={errClass('total_matches')} type="number" min={0} value={player.total_matches} onChange={e => update({ total_matches: +e.target.value })} />
            {showErrors && <FieldError error={errors.total_matches} />}
          </div>
          <div>
            <Label>Runs</Label>
            <Input className={errClass('total_runs')} type="number" min={0} value={player.total_runs} onChange={e => update({ total_runs: +e.target.value })} />
            {showErrors && <FieldError error={errors.total_runs} />}
          </div>
          <div>
            <Label>Highest Score</Label>
            <Input className={errClass('highest_score')} type="number" min={0} value={player.highest_score} onChange={e => update({ highest_score: +e.target.value })} />
            {showErrors && <FieldError error={errors.highest_score} />}
          </div>
          <div>
            <Label>Strike Rate</Label>
            <Input className={errClass('strike_rate')} type="number" step="0.01" min={0} max={500} value={player.strike_rate} onChange={e => update({ strike_rate: +e.target.value })} />
            {showErrors && <FieldError error={errors.strike_rate} />}
          </div>
          <div>
            <Label>Fifties</Label>
            <Input className={errClass('fifties')} type="number" min={0} value={player.fifties} onChange={e => update({ fifties: +e.target.value })} />
            {showErrors && <FieldError error={errors.fifties} />}
          </div>
          <div>
            <Label>Centuries</Label>
            <Input className={errClass('centuries')} type="number" min={0} value={player.centuries} onChange={e => update({ centuries: +e.target.value })} />
            {showErrors && <FieldError error={errors.centuries} />}
          </div>

          {/* Bowling Stats */}
          <div className="col-span-2 pt-4 border-t">
            <h4 className="font-medium text-sm text-muted-foreground mb-3">Bowling Statistics</h4>
          </div>
          <div>
            <Label>Wickets</Label>
            <Input className={errClass('wickets')} type="number" min={0} value={player.wickets} onChange={e => update({ wickets: +e.target.value })} />
            {showErrors && <FieldError error={errors.wickets} />}
          </div>
          <div>
            <Label>Best Bowling (e.g. 5/23)</Label>
            <Input className={errClass('best_bowling')} placeholder="e.g. 5/23" value={player.best_bowling} onChange={e => update({ best_bowling: e.target.value })} />
            {showErrors && <FieldError error={errors.best_bowling} />}
          </div>
          <div>
            <Label>Bowling Average</Label>
            <Input className={errClass('bowling_average')} type="number" step="0.01" min={0} value={player.bowling_average} onChange={e => update({ bowling_average: +e.target.value })} />
            {showErrors && <FieldError error={errors.bowling_average} />}
          </div>
          <div>
            <Label>Economy Rate</Label>
            <Input className={errClass('economy_rate')} type="number" step="0.01" min={0} max={30} value={player.economy_rate} onChange={e => update({ economy_rate: +e.target.value })} />
            {showErrors && <FieldError error={errors.economy_rate} />}
          </div>

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
                  <>
                    <Input className={errClass('profile_picture_url')} placeholder="Enter image URL" value={player.profile_picture_url} onChange={e => update({ profile_picture_url: e.target.value })} />
                    {showErrors && <FieldError error={errors.profile_picture_url} />}
                  </>
                ) : (
                  <div className="space-y-2">
                    <Input type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; onImageFileSelect(file || null); }} />
                    {selectedImageFile && <p className="text-sm text-muted-foreground">Selected: {selectedImageFile.name}</p>}
                  </div>
                )}
              </>
            ) : (
              <>
                <Input className={errClass('profile_picture_url')} placeholder="Enter image URL" value={player.profile_picture_url} onChange={e => update({ profile_picture_url: e.target.value })} />
                {showErrors && <FieldError error={errors.profile_picture_url} />}
              </>
            )}
          </div>
        </div>
        <Button onClick={handleSubmit} className="w-full mt-4 gradient-gold" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
