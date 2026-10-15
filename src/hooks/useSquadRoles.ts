import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SquadRole = 'captain' | 'vice_captain';
export interface SquadRow { team_id: string; player_id: string; squad_role: SquadRole | null }

/** Live playing-squad rows (incl. captain / vice-captain) for a match. */
export function useSquadRoles(matchId: string) {
  const [rows, setRows] = useState<SquadRow[]>([]);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('match_squads').select('team_id, player_id, squad_role').eq('match_id', matchId);
      setRows((data as SquadRow[]) || []);
    };
    load();
    const ch = supabase
      .channel(`squad-roles-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_squads', filter: `match_id=eq.${matchId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId]);
  const roles = new Map(rows.filter(r => r.squad_role).map(r => [r.player_id, r.squad_role as SquadRole]));
  return { rows, roles };
}

/** Squads are ready when both teams have equal (>=5) players and each has exactly one C and one VC. */
export function squadsReady(rows: SquadRow[], team1Id: string, team2Id: string) {
  const t1 = rows.filter(r => r.team_id === team1Id);
  const t2 = rows.filter(r => r.team_id === team2Id);
  const ok = (t: SquadRow[]) =>
    t.filter(r => r.squad_role === 'captain').length === 1 && t.filter(r => r.squad_role === 'vice_captain').length === 1;
  return t1.length >= 5 && t1.length === t2.length && ok(t1) && ok(t2);
}
