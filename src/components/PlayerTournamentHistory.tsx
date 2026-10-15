import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, ChevronDown } from 'lucide-react';
import { MatchDownloadButton } from '@/components/tournament/MatchDownloadButton';
import { Match } from '@/lib/tournament-types';
import { Owner } from '@/lib/types';

interface MatchRec {
  match: Match;
  team1?: Owner;
  team2?: Owner;
  batted: boolean;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  bowledBalls: number;
  conceded: number;
  wickets: number;
  catches: number;
}

interface Row {
  tournamentId: string;
  name: string;
  status: string;
  startDate: string;
  matches: MatchRec[];
}

const overs = (b: number) => `${Math.floor(b / 6)}.${b % 6}`;
const WIDE = ['wide', 'wd'];
const NOBALL = ['no_ball', 'noball', 'nb'];
const BYES = ['bye', 'leg_bye', 'legbye', 'b', 'lb'];

function summarize(ms: MatchRec[]) {
  const s = { m: ms.length, runs: 0, balls: 0, fours: 0, sixes: 0, hs: 0, fifties: 0, hundreds: 0, wkts: 0, bb: 0, conceded: 0, catches: 0, bestW: -1, bestR: 0 };
  for (const r of ms) {
    s.runs += r.runs; s.balls += r.balls; s.fours += r.fours; s.sixes += r.sixes;
    s.hs = Math.max(s.hs, r.runs);
    if (r.runs >= 100) s.hundreds++; else if (r.runs >= 50) s.fifties++;
    s.wkts += r.wickets; s.bb += r.bowledBalls; s.conceded += r.conceded; s.catches += r.catches;
    if (r.bowledBalls > 0 && (r.wickets > s.bestW || (r.wickets === s.bestW && r.conceded < s.bestR))) {
      s.bestW = r.wickets; s.bestR = r.conceded;
    }
  }
  return { ...s, best: s.bestW >= 0 ? `${s.bestW}/${s.bestR}` : '-' };
}

function StatGrid({ items }: { items: [string, string | number][] }) {
  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      {items.map(([l, v]) => (
        <div key={l}>
          <p className="text-sm sm:text-base font-bold">{v}</p>
          <p className="text-[10px] text-muted-foreground">{l}</p>
        </div>
      ))}
    </div>
  );
}

export function PlayerTournamentHistory({ playerId }: { playerId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRows(null);
      setOpen(null);
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
      const { data: matches } = await supabase.from('matches').select('*').in('id', matchIds);
      const teamIds = [...new Set((matches || []).flatMap(m => [m.team1_id, m.team2_id]).filter(Boolean) as string[])];
      const tIds = [...new Set((matches || []).map(m => m.tournament_id))];
      const [{ data: tours }, { data: owners }] = await Promise.all([
        supabase.from('tournaments').select('id, name, status, start_date').in('id', tIds),
        teamIds.length ? supabase.from('owners').select('*').in('id', teamIds) : Promise.resolve({ data: [] as Owner[] }),
      ]);
      const ownerMap = new Map(((owners as Owner[]) || []).map(o => [o.id, o]));

      const recs = new Map<string, MatchRec>();
      for (const m of matches || []) {
        recs.set(m.id, {
          match: m as unknown as Match,
          team1: m.team1_id ? ownerMap.get(m.team1_id) : undefined,
          team2: m.team2_id ? ownerMap.get(m.team2_id) : undefined,
          batted: false, runs: 0, balls: 0, fours: 0, sixes: 0, out: false,
          bowledBalls: 0, conceded: 0, wickets: 0, catches: 0,
        });
      }
      for (const b of balls || []) {
        const r = recs.get(innToMatch.get(b.innings_id) || ''); if (!r) continue;
        const et = (b.extra_type || '').toLowerCase();
        const wt = (b.wicket_type || '').toLowerCase();
        if (b.batsman_id === playerId) {
          r.batted = true;
          if (!WIDE.includes(et)) r.balls++;
          r.runs += b.runs_scored;
          if (b.runs_scored === 4) r.fours++;
          if (b.runs_scored === 6) r.sixes++;
          if (b.is_wicket) r.out = true;
        }
        if (b.bowler_id === playerId) {
          if (!WIDE.includes(et) && !NOBALL.includes(et)) r.bowledBalls++;
          r.conceded += b.runs_scored + (BYES.includes(et) ? 0 : b.extras);
          if (b.is_wicket && !wt.includes('run')) r.wickets++;
        }
        if (b.fielder_id === playerId && b.is_wicket && wt.includes('caught')) r.catches++;
      }

      const list: Row[] = (tours || []).map(t => ({
        tournamentId: t.id, name: t.name, status: t.status, startDate: t.start_date,
        matches: [...recs.values()]
          .filter(r => r.match.tournament_id === t.id)
          .sort((a, b) => b.match.match_date.localeCompare(a.match.match_date)),
      })).filter(r => r.matches.length).sort((a, b) => b.startDate.localeCompare(a.startDate));
      if (!cancelled) setRows(list);
    })();
    return () => { cancelled = true; };
  }, [playerId]);

  const career = rows ? summarize(rows.flatMap(r => r.matches)) : null;

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

        {career && career.m > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">All tournaments</p>
            <StatGrid items={[['50s', career.fifties], ['100s', career.hundreds], ['Best Bowling', career.best], ['HS', career.hs]]} />
          </div>
        )}

        {rows?.map(r => {
          const s = summarize(r.matches);
          const isOpen = open === r.tournamentId;
          return (
            <div key={r.tournamentId} className="rounded-lg bg-muted overflow-hidden">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : r.tournamentId)}
                className="w-full p-3 text-left hover:bg-muted-foreground/5 transition-colors"
                aria-expanded={isOpen}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-sm break-words min-w-0">{r.name}</p>
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {r.status} · {r.startDate?.slice(0, 4)}
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </span>
                </div>
                <StatGrid items={[
                  ['M', s.m], ['Runs', s.runs], ['HS', s.hs],
                  ['SR', s.balls ? ((s.runs / s.balls) * 100).toFixed(1) : '-'],
                  ['50s', s.fifties], ['100s', s.hundreds], ['4s/6s', `${s.fours}/${s.sixes}`], ['Catches', s.catches],
                  ['Wkts', s.wkts], ['Overs', overs(s.bb)],
                  ['Econ', s.bb ? (s.conceded / (s.bb / 6)).toFixed(2) : '-'], ['Best', s.best],
                ]} />
                <p className="mt-2 text-[11px] text-primary">{isOpen ? 'Hide matches' : 'Tap to view match-wise records'}</p>
              </button>

              {isOpen && (
                <div className="divide-y divide-border/40 border-t border-border/40 bg-background/30">
                  {r.matches.map(m => (
                    <div key={m.match.id} className="flex items-center gap-2 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold break-words">
                          {m.team1?.team_name ?? 'TBD'} vs {m.team2?.team_name ?? 'TBD'}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(m.match.match_date).toLocaleDateString()} · {m.match.status}
                        </p>
                        <p className="mt-1 text-xs">
                          <span className="text-muted-foreground">Bat: </span>
                          {m.batted ? `${m.runs}${m.out ? '' : '*'} (${m.balls})` : 'DNB'}
                          <span className="text-muted-foreground"> · Bowl: </span>
                          {m.bowledBalls ? `${m.wickets}/${m.conceded} (${overs(m.bowledBalls)})` : '-'}
                          {m.catches > 0 && <span className="text-muted-foreground"> · {m.catches} ct</span>}
                        </p>
                      </div>
                      <MatchDownloadButton match={m.match} team1={m.team1} team2={m.team2} className="shrink-0" />
                    </div>
                  ))}
                  <p className="px-3 py-2 text-[10px] text-muted-foreground">Download icon opens the full match scorecard (PDF).</p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
