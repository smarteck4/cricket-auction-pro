import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Match, MatchFormat, MatchStatus, Tournament, Venue, FORMAT_OVERS, FORMAT_LABELS } from '@/lib/tournament-types';
import { Owner } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle } from 'lucide-react';

interface MatchFormProps {
  match?: Match | null;
  tournaments: Tournament[];
  teams: Owner[];
  venues: Venue[];
  onSubmit: (data: Partial<Match>) => void;
  onCancel: () => void;
}

const MIN_TEAM_PLAYERS = 5;
const MAX_TEAM_PLAYERS = 11;

export function MatchForm({ match, tournaments, teams, venues, onSubmit, onCancel }: MatchFormProps) {
  const [tournamentId, setTournamentId] = useState(match?.tournament_id || '');
  const [team1Id, setTeam1Id] = useState(match?.team1_id || '');
  const [team2Id, setTeam2Id] = useState(match?.team2_id || '');
  const [venueId, setVenueId] = useState(match?.venue_id || '');
  const [matchDate, setMatchDate] = useState(match?.match_date?.slice(0, 16) || '');
  const [format, setFormat] = useState<MatchFormat>(match?.format || 'T20');
  const [oversPerInnings, setOversPerInnings] = useState(match?.overs_per_innings || FORMAT_OVERS['T20']);
  const [status, setStatus] = useState<MatchStatus>(match?.status || 'scheduled');
  
  const [team1PlayerCount, setTeam1PlayerCount] = useState<number | null>(null);
  const [team2PlayerCount, setTeam2PlayerCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const isCustomFormat = format === 'Custom';

  useEffect(() => {
    if (team1Id) fetchTeamPlayerCount(team1Id, setTeam1PlayerCount);
    else setTeam1PlayerCount(null);
  }, [team1Id]);

  useEffect(() => {
    if (team2Id) fetchTeamPlayerCount(team2Id, setTeam2PlayerCount);
    else setTeam2PlayerCount(null);
  }, [team2Id]);

  const fetchTeamPlayerCount = async (teamId: string, setter: (count: number) => void) => {
    const { count } = await supabase
      .from('team_players')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', teamId);
    setter(count || 0);
  };

  const handleTournamentChange = (value: string) => {
    setTournamentId(value);
    const tournament = tournaments.find((t) => t.id === value);
    if (tournament) {
      setFormat(tournament.format);
      setOversPerInnings(tournament.overs_per_innings);
    }
  };

  const handleFormatChange = (value: MatchFormat) => {
    setFormat(value);
    if (value !== 'Custom') {
      setOversPerInnings(FORMAT_OVERS[value]);
    }
  };

  const getTeamValidation = (count: number | null) => {
    if (count === null) return null;
    if (count < MIN_TEAM_PLAYERS) return { valid: false, message: `Needs ${MIN_TEAM_PLAYERS - count} more player(s)` };
    if (count > MAX_TEAM_PLAYERS) return { valid: false, message: `Has ${count - MAX_TEAM_PLAYERS} extra player(s)` };
    return { valid: true, message: `${count} players` };
  };

  const team1Validation = getTeamValidation(team1PlayerCount);
  const team2Validation = getTeamValidation(team2PlayerCount);
  const canSubmit = (!team1Id || team1Validation?.valid !== false) && (!team2Id || team2Validation?.valid !== false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      tournament_id: tournamentId,
      team1_id: team1Id || null,
      team2_id: team2Id || null,
      venue_id: venueId || null,
      match_date: matchDate,
      format,
      overs_per_innings: oversPerInnings,
      status,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Tournament</Label>
        <Select value={tournamentId} onValueChange={handleTournamentChange} required>
          <SelectTrigger>
            <SelectValue placeholder="Select tournament" />
          </SelectTrigger>
          <SelectContent>
            {tournaments.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Team 1</Label>
          <Select value={team1Id} onValueChange={setTeam1Id}>
            <SelectTrigger>
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.team_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {team1Validation && (
            <p className={`text-xs flex items-center gap-1 ${team1Validation.valid ? 'text-green-600' : 'text-destructive'}`}>
              {!team1Validation.valid && <AlertCircle className="h-3 w-3" />}
              {team1Validation.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Team 2</Label>
          <Select value={team2Id} onValueChange={setTeam2Id}>
            <SelectTrigger>
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent>
              {teams.filter((t) => t.id !== team1Id).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.team_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {team2Validation && (
            <p className={`text-xs flex items-center gap-1 ${team2Validation.valid ? 'text-green-600' : 'text-destructive'}`}>
              {!team2Validation.valid && <AlertCircle className="h-3 w-3" />}
              {team2Validation.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Venue</Label>
        <Select value={venueId} onValueChange={setVenueId}>
          <SelectTrigger>
            <SelectValue placeholder="Select venue" />
          </SelectTrigger>
          <SelectContent>
            {venues.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}, {v.city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="matchDate">Match Date & Time</Label>
        <Input
          id="matchDate"
          type="datetime-local"
          value={matchDate}
          onChange={(e) => setMatchDate(e.target.value)}
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
              <SelectItem value="T5">{FORMAT_LABELS.T5}</SelectItem>
              <SelectItem value="T10">{FORMAT_LABELS.T10}</SelectItem>
              <SelectItem value="T20">{FORMAT_LABELS.T20}</SelectItem>
              <SelectItem value="ODI">{FORMAT_LABELS.ODI}</SelectItem>
              <SelectItem value="Custom">{FORMAT_LABELS.Custom}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="overs">Overs per Innings</Label>
          <Input
            id="overs"
            type="number"
            min={1}
            max={50}
            value={oversPerInnings}
            onChange={(e) => setOversPerInnings(parseInt(e.target.value) || 20)}
            disabled={!isCustomFormat}
            className={!isCustomFormat ? 'bg-muted cursor-not-allowed' : ''}
          />
          {!isCustomFormat && (
            <p className="text-xs text-muted-foreground">Auto-set based on format</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as MatchStatus)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 justify-end pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {match ? 'Update Match' : 'Schedule Match'}
        </Button>
      </div>
    </form>
  );
}
