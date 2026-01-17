import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tournament, MatchFormat, TournamentStatus, FORMAT_OVERS } from '@/lib/tournament-types';

interface TournamentFormProps {
  tournament?: Tournament | null;
  onSubmit: (data: Partial<Tournament>) => void;
  onCancel: () => void;
}

export function TournamentForm({ tournament, onSubmit, onCancel }: TournamentFormProps) {
  const [name, setName] = useState(tournament?.name || '');
  const [format, setFormat] = useState<MatchFormat>(tournament?.format || 'T20');
  const [oversPerInnings, setOversPerInnings] = useState(tournament?.overs_per_innings || FORMAT_OVERS['T20']);
  const [startDate, setStartDate] = useState(tournament?.start_date || '');
  const [endDate, setEndDate] = useState(tournament?.end_date || '');
  const [venue, setVenue] = useState(tournament?.venue || '');
  const [status, setStatus] = useState<TournamentStatus>(tournament?.status || 'upcoming');

  const handleFormatChange = (value: MatchFormat) => {
    setFormat(value);
    setOversPerInnings(FORMAT_OVERS[value]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      format,
      overs_per_innings: oversPerInnings,
      start_date: startDate,
      end_date: endDate,
      venue: venue || null,
      status,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Tournament Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter tournament name"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Format</Label>
          <Select value={format} onValueChange={(v) => handleFormatChange(v as MatchFormat)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="T10">T10</SelectItem>
              <SelectItem value="T20">T20</SelectItem>
              <SelectItem value="ODI">One Day</SelectItem>
              <SelectItem value="Test">Test</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="overs">Overs per Innings</Label>
          <Input
            id="overs"
            type="number"
            min={1}
            max={90}
            value={oversPerInnings}
            onChange={(e) => setOversPerInnings(parseInt(e.target.value) || 20)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endDate">End Date</Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="venue">Default Venue</Label>
        <Input
          id="venue"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="Enter venue (optional)"
        />
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as TournamentStatus)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="ongoing">Ongoing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 justify-end pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {tournament ? 'Update Tournament' : 'Create Tournament'}
        </Button>
      </div>
    </form>
  );
}
