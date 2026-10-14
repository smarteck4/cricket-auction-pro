import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';

interface Row {
  tournamentId: string;
  name: string;
  status: string;
  startDate: string;
  matches: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  highest: number;
  wickets: number;
  legalBowled: number;
  conceded: number;
  catches: number;
}

const overs = (b: number) => `${Math.floor(b / 6)}.${b % 6}`;

export function PlayerTournamentHistory({ playerId }: { playerId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRows(null);
      const { data: balls } = await supabase
        .from('match_balls')
        .select('innings_id, batsman_id, bowler_id, fielder_id, runs_scored, extras, extra_type, is_wicket, wicket_type')
        .or(`batsman_id.eq.${playerId},bowler_id.eq.${playerId},fielder_id.eq.${playerId}`);
      const { data: squads } = await supabase.from('match_squads').select('match_id').eq('player_id', playerId);
      const inningsIds = [...new Set((balls || []).map(b => b.innings_id))];
      const { data: innings } = inningsIds.length
        ? await supabase.from('match_innings').select('id, match_id').in('id', inningsIds)
        : { data: [] as { id: string; match_id: string }[] };
      const innToMatch = new Map((innings || []).map(i => [i.id, i.match_id]));
      const matchIds = [...new Set([...(innings || []).map(i => i.match_id), ...(squads || []).map(s => s.match_id)])];
      if (!matchIds.length) { if (!cancelled) setRows([]); return; }
      const { data: matches } = await supabase.from('matches').select('id, tournament_id').in('id', matchIds);
      const matchToT = new Map((matches || []).map(m => [m.id, m.tournament_id]));
      const tIds = [...new Set((matches || []).map(m => m.tournament_id))];
      const { data: tours } = await supabase.from('tournaments').select('id, name, status, start_date').in('id', tIds);

      const map = new Map<string, Row>();
      const matchSets = new Map<string, Set<string>>();
      const scorePerMatch = new Map<string, number>();
      for (const t of tours || []) {
        map.set(t.id, { tournamentId: t.id, name: t.name, status: t.status, startDate: t.start_date, matches: 0, runs: 0, balls: 0, fours: 0, sixes: 0, highest: 0, wickets: 0, legalBowled: 0, conceded: 0, catches: 0 });
        matchSets.set(t.id, new Set());
      }
      const addMatch = (mid: string) => { const t = matchToT.get(mid); if (t) matchSets.get(t)?.add(mid); };
      (squads || []).forEach(s => addMatch(s.match_id));

      for (const b of balls || []) {
        const mid = innToMatch.get(b.innings_id); if (!mid) continue;
        const r = map.get(matchToT.get(mid) || ''); if (!r) continue;
        addMatch(mid);
        const et = (b.extra_type || '').toLowerCase();
        if (b.batsman_id === playerId) {
          if (et !== 'wide' && et !== 'wd') r.balls++;
          r.runs += b.runs_scored;
          if (b.runs_scored === 4) r.fours++;
          if (b.runs_scored === 6) r.sixes++;
          scorePerMatch.set(mid, (scorePerMatch.get(mid) || 0) + b.runs_scored);
          r.highest = Math.max(r.highest, scorePerMatch.get(mid)!);
        }
        if (b.bowler_id === playerId) {
          if (!['wide', 'wd', 'no_ball', 'noball', 'nb'].includes(et)) r.legalBowled++;
          const byes = ['bye', 'leg_bye', 'legbye', 'b', 'lb'].includes(et);
          r.conceded += b.runs_scored + (byes ? 0 : b.extras);
          if (b.is_wicket && (b.wicket_type || '').toLowerCase().replace(' ', '_') !== 'run_out') r.wickets++;
        }
        if (b.fielder_id === playerId && b.is_wicket && (b.wicket_type || '').toLowerCase().includes('caught')) r.catches++;
      }
      for (const [t, s] of matchSets) map.get(t)!.matches = s.size;
      const list = [...map.values()].filter(r => r.matches > 0).sort((a, b) => b.startDate.localeCompare(a.startDate));
      if (!cancelled) setRows(list);
    })();
    return () => { cancelled = true; };
  }, [playerId]);

  return (
    <Card>
      <CardHeader className="pb-3 px-4 sm:px-6">
        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
          <Trophy className="w-4 h-4" /> Tournament Records
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 space-y-3">
        {rows === null && <p className="text-sm text-muted-foreground">Loading records…</p>}
        {rows?.length === 0 && <p className="text-sm text-muted-foreground">No tournament matches played yet.</p>}
        {rows?.map(r => (
          <div key={r.tournamentId} className="rounded-lg bg-muted p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="font-semibold text-sm break-words min-w-0">{r.name}</p>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">{r.status} · {r.startDate?.slice(0, 4)}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                ['M', r.matches],
                ['Runs', r.runs],
                ['HS', r.highest],
                ['SR', r.balls ? ((r.runs / r.balls) * 100).toFixed(1) : '-'],
                ['4s/6s', `${r.fours}/${r.sixes}`],
                ['Wkts', r.wickets],
                ['Overs', overs(r.legalBowled)],
                ['Econ', r.legalBowled ? (r.conceded / (r.legalBowled / 6)).toFixed(2) : '-'],
              ].map(([l, v]) => (
                <div key={l as string}>
                  <p className="text-sm sm:text-base font-bold">{v}</p>
                  <p className="text-[10px] text-muted-foreground">{l}</p>
                </div>
              ))}
            </div>
            {r.catches > 0 && <p className="mt-2 text-[11px] text-muted-foreground">Catches: {r.catches}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
