import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Owner, Player } from '@/lib/types';
import { Match } from '@/lib/tournament-types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlayerAvatar, TeamLogo } from './ScoreAvatars';
import { Save, Users } from 'lucide-react';

interface PlayingSquadSelectorProps {
  match: Match;
  team1: Owner;
  team2: Owner;
  /** Full purchased roster of each team. */
  team1Roster: Player[];
  team2Roster: Player[];
  canManage: boolean;
  onSaved: () => void;
}

const MIN_SIZE = 5;
const MAX_SIZE = 11;

/** Admin tool: pick the playing squad for each team. Both teams must field an equal number of players. */
export function PlayingSquadSelector({
  match,
  team1,
  team2,
  team1Roster,
  team2Roster,
  canManage,
  onSaved,
}: PlayingSquadSelectorProps) {
  const { toast } = useToast();
  const [teamSize, setTeamSize] = useState(MIN_SIZE);
  const [sel1, setSel1] = useState<string[]>([]);
  const [sel2, setSel2] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('match_squads')
        .select('team_id, player_id')
        .eq('match_id', match.id);
      const a = (data || []).filter((r) => r.team_id === team1.id).map((r) => r.player_id);
      const b = (data || []).filter((r) => r.team_id === team2.id).map((r) => r.player_id);
      setSel1(a);
      setSel2(b);
      if (a.length >= MIN_SIZE && a.length === b.length) setTeamSize(a.length);
      setLoaded(true);
    };
    load();
  }, [match.id, team1.id, team2.id]);

  const maxPossible = Math.min(team1Roster.length, team2Roster.length, MAX_SIZE);
  const sizeOptions = useMemo(() => {
    const out: number[] = [];
    for (let n = MIN_SIZE; n <= Math.max(MIN_SIZE, maxPossible); n++) out.push(n);
    return out;
  }, [maxPossible]);

  const toggle = (teamNum: 1 | 2, id: string) => {
    const [sel, setSel] = teamNum === 1 ? [sel1, setSel1] : [sel2, setSel2];
    if (sel.includes(id)) {
      setSel(sel.filter((x) => x !== id));
      return;
    }
    if (sel.length >= teamSize) {
      toast({
        title: `Only ${teamSize} players allowed`,
        description: 'Remove a selected player first, or increase the team size.',
        variant: 'destructive',
      });
      return;
    }
    setSel([...sel, id]);
  };

  const valid = sel1.length === teamSize && sel2.length === teamSize;

  const save = async () => {
    if (!valid) {
      toast({
        title: 'Squads must be equal',
        description: `Both teams need exactly ${teamSize} players (currently ${sel1.length} vs ${sel2.length}).`,
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    const { error: delErr } = await supabase.from('match_squads').delete().eq('match_id', match.id);
    if (delErr) {
      setSaving(false);
      toast({ title: 'Error', description: delErr.message, variant: 'destructive' });
      return;
    }
    const rows = [
      ...sel1.map((player_id) => ({ match_id: match.id, team_id: team1.id, player_id })),
      ...sel2.map((player_id) => ({ match_id: match.id, team_id: team2.id, player_id })),
    ];
    const { error } = await supabase.from('match_squads').insert(rows);
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Playing squads saved', description: `${teamSize} vs ${teamSize} confirmed.` });
    onSaved();
  };

  const renderTeam = (team: Owner, roster: Player[], sel: string[], teamNum: 1 | 2) => (
    <div className="rounded-xl border border-border/40 overflow-hidden">
      <div className="flex items-center justify-between gap-2 bg-muted/40 px-3 py-2.5">
        <span className="inline-flex min-w-0 items-center gap-2">
          <TeamLogo team={team} size={26} />
          <span className="truncate text-sm font-bold">{team.team_name}</span>
        </span>
        <Badge variant={sel.length === teamSize ? 'default' : 'secondary'} className="text-[10px]">
          {sel.length}/{teamSize}
        </Badge>
      </div>
      <div className="max-h-[320px] divide-y divide-border/40 overflow-y-auto">
        {roster.length === 0 && (
          <p className="px-3 py-5 text-center text-sm text-muted-foreground">No players bought yet</p>
        )}
        {roster.map((p) => {
          const checked = sel.includes(p.id);
          return (
            <label
              key={p.id}
              className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors ${
                checked ? 'bg-primary/10' : 'hover:bg-muted/40'
              }`}
            >
              <Checkbox checked={checked} onCheckedChange={() => toggle(teamNum, p.id)} disabled={!canManage} />
              <PlayerAvatar player={p} size={28} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.name}</p>
                <p className="text-[11px] text-muted-foreground">{p.player_role.replace('_', '-')}</p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );

  if (!loaded) return null;

  return (
    <div className="rounded-xl border border-border/40 bg-card/50 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Playing squad selection
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Players per team</span>
          <Select
            value={String(teamSize)}
            onValueChange={(v) => {
              const n = Number(v);
              setTeamSize(n);
              setSel1((s) => s.slice(0, n));
              setSel2((s) => s.slice(0, n));
            }}
            disabled={!canManage}
          >
            <SelectTrigger className="h-8 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sizeOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} v {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {renderTeam(team1, team1Roster, sel1, 1)}
        {renderTeam(team2, team2Roster, sel2, 2)}
      </div>

      {canManage && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {valid
              ? `Ready: ${teamSize} v ${teamSize}`
              : `Both teams must have exactly ${teamSize} players (${sel1.length} vs ${sel2.length}).`}
          </p>
          <Button size="sm" onClick={save} disabled={!valid || saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save playing squads'}
          </Button>
        </div>
      )}
    </div>
  );
}
