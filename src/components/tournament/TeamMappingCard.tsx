import { useMemo } from 'react';
import { Owner, Player, ROLE_LABELS } from '@/lib/types';
import { REAL_TEAMS, getRealTeam, realTeamsByCompetition } from '@/lib/real-teams';
import { pickPlayingXI } from '@/lib/playing-xi';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlayerAvatar } from './ScoreAvatars';
import { Star } from 'lucide-react';

interface TeamMappingCardProps {
  owner: Owner;
  /** Players this team bought in the auction. */
  roster: Player[];
  /** Squad size used for the auto Playing XI preview. */
  squadSize?: number;
  onChange: (patch: Partial<Owner>) => void;
}

const NONE = '__none__';

/**
 * Maps an auction team onto a real cricket team (logo colours + short code),
 * lets the admin nominate a captain, and previews the auto-generated
 * playing XI built from the purchased roster.
 */
export function TeamMappingCard({ owner, roster, squadSize = 11, onChange }: TeamMappingCardProps) {
  const real = getRealTeam(owner.real_team_key);

  const xi = useMemo(
    () => pickPlayingXI(roster, Math.min(squadSize, Math.max(roster.length, 1)), { captainId: owner.captain_id }),
    [roster, squadSize, owner.captain_id],
  );

  const selectRealTeam = (key: string) => {
    if (key === NONE) {
      onChange({ real_team_key: null, team_short_code: null });
      return;
    }
    const team = REAL_TEAMS.find((t) => t.key === key);
    if (!team) return;
    onChange({
      real_team_key: team.key,
      team_short_code: team.shortCode,
      team_name: owner.team_name?.trim() ? owner.team_name : team.name,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Real cricket team</Label>
        <Select value={owner.real_team_key ?? NONE} onValueChange={selectRealTeam}>
          <SelectTrigger>
            <SelectValue placeholder="Map to a real team" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value={NONE}>No mapping</SelectItem>
            {realTeamsByCompetition().map((group) => (
              <SelectGroup key={group.competition}>
                <SelectLabel>{group.competition}</SelectLabel>
                {group.teams.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.name} ({t.shortCode})
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        {real && (
          <div className="mt-2 flex items-center gap-2">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border text-[11px] font-black"
              style={{ background: real.color, color: real.accent, borderColor: real.accent }}
            >
              {real.shortCode}
            </span>
            <span className="text-xs text-muted-foreground">
              Logo colours and short code auto-applied from {real.name}
            </span>
          </div>
        )}
      </div>

      <div>
        <Label>Captain</Label>
        <Select
          value={owner.captain_id ?? NONE}
          onValueChange={(v) => onChange({ captain_id: v === NONE ? null : v })}
          disabled={roster.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder={roster.length ? 'Choose a captain' : 'No players bought yet'} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value={NONE}>No captain</SelectItem>
            {roster.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} — {ROLE_LABELS[p.player_role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="mb-0">Auto Playing XI</Label>
          <Badge variant="secondary" className="text-[10px]">
            {xi.length} players
          </Badge>
        </div>
        {roster.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Buy players in the auction and the playing XI fills in automatically.
          </p>
        ) : (
          <div className="max-h-56 divide-y divide-border/40 overflow-y-auto rounded-lg border border-border/40">
            {xi.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 px-2.5 py-1.5">
                <span className="w-4 text-[11px] text-muted-foreground">{i + 1}</span>
                <PlayerAvatar player={p} size={24} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                {p.id === owner.captain_id && (
                  <Badge className="gap-1 text-[10px]">
                    <Star className="h-3 w-3" />C
                  </Badge>
                )}
                <span className="text-[10px] uppercase text-muted-foreground">{p.category}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
