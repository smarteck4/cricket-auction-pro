import { Match, TournamentPoints, PlayerMatchStats, Tournament } from '@/lib/tournament-types';
import { Owner, Player } from '@/lib/types';
import { format } from 'date-fns';
import { MapPin, CalendarDays, Trophy, Target, Users } from 'lucide-react';

const initials = (name?: string | null) =>
  (name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

function TeamCrest({ team, ring }: { team?: Owner; ring: string }) {
  return (
    <div className="text-center flex-1 min-w-0">
      <div
        className={`w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 rounded-full overflow-hidden flex items-center justify-center bg-broadcast-surface border-2 ${ring} shadow-lg`}
      >
        {team?.team_logo_url ? (
          <img src={team.team_logo_url} alt={`${team.team_name} logo`} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="bc-heading text-lg sm:text-xl text-broadcast-fg">{initials(team?.team_name)}</span>
        )}
      </div>
      <p className="text-xs sm:text-sm font-bold uppercase tracking-widest truncate text-broadcast-fg">
        {team?.team_name ?? 'TBD'}
      </p>
    </div>
  );
}

export function FeaturedMatchTile({
  match,
  teams,
  onOpen,
}: {
  match?: Match;
  teams: Owner[];
  onOpen?: () => void;
}) {
  if (!match) {
    return (
      <div className="bc-tile md:col-span-8 p-6 flex flex-col items-center justify-center min-h-[220px] text-center">
        <Trophy className="h-8 w-8 mb-3 text-broadcast-accent/60" />
        <p className="bc-label">No featured match</p>
        <p className="text-sm text-broadcast-muted mt-1">Fixtures schedule hone ke baad yahan dikhega</p>
      </div>
    );
  }

  const team1 = teams.find((t) => t.id === match.team1_id);
  const team2 = teams.find((t) => t.id === match.team2_id);
  const isLive = match.status === 'live';

  return (
    <div
      className={`bc-tile bc-tile-hover md:col-span-8 p-6 relative overflow-hidden ${onOpen ? 'cursor-pointer' : ''}`}
      onClick={onOpen}
    >
      <div className="absolute top-0 right-0 p-3">
        <span
          className={`text-[10px] bc-heading px-2 py-1 rounded uppercase ${
            isLive ? 'bg-destructive text-destructive-foreground' : 'bg-broadcast-accent text-broadcast'
          }`}
        >
          {isLive ? 'Live Now' : 'Featured Match'}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 py-4 mt-2">
        <TeamCrest team={team1} ring="border-broadcast-accent/60" />
        <div className="text-center px-1 sm:px-4 shrink-0">
          <div className="bc-label">{format(new Date(match.match_date), 'EEEE, dd MMM')}</div>
          <div className="bc-heading text-3xl sm:text-4xl text-broadcast-accent my-1">VS</div>
          <div className="text-[11px] text-broadcast-muted flex items-center justify-center gap-1">
            <MapPin className="h-3 w-3" />
            {match.venue?.name ?? 'Venue TBD'}
          </div>
        </div>
        <TeamCrest team={team2} ring="border-broadcast-accent-2/60" />
      </div>

      <div className="mt-2 pt-3 border-t border-broadcast-fg/5 flex items-center justify-between">
        <span className="text-xs text-broadcast-muted">
          {match.format} • {match.overs_per_innings} overs
        </span>
        <span className="text-[11px] uppercase font-bold tracking-widest text-broadcast-accent">
          {format(new Date(match.match_date), 'p')}
        </span>
      </div>
    </div>
  );
}

export function TournamentMetaTile({ tournament }: { tournament: Tournament }) {
  const statusTone =
    tournament.status === 'ongoing'
      ? 'text-broadcast-accent-2'
      : tournament.status === 'completed'
        ? 'text-broadcast-muted'
        : 'text-broadcast-accent';

  const rows: Array<[string, JSX.Element | string]> = [
    ['Format', <span className="font-bold text-broadcast-accent">{tournament.format} League</span>],
    ['Overs', <span className="font-bold text-broadcast-fg">{tournament.overs_per_innings} Overs</span>],
    [
      'Dates',
      <span className="font-bold text-broadcast-fg">
        {format(new Date(tournament.start_date), 'dd MMM')} - {format(new Date(tournament.end_date), 'dd MMM')}
      </span>,
    ],
    [
      'Status',
      <span className={`flex items-center gap-1.5 font-bold capitalize ${statusTone}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        {tournament.status}
      </span>,
    ],
  ];

  return (
    <div className="bc-tile bc-tile-hover md:col-span-4 p-6 flex flex-col">
      <h3 className="bc-label mb-4">Tournament Details</h3>
      <div className="space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between items-center text-sm">
            <span className="text-broadcast-muted">{label}</span>
            {value}
          </div>
        ))}
        {tournament.venue && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-broadcast-muted">Venue</span>
            <span className="font-bold text-broadcast-fg truncate max-w-[55%]">{tournament.venue}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function StandingsTile({
  points,
  onViewFull,
}: {
  points: TournamentPoints[];
  onViewFull: () => void;
}) {
  const top = [...points]
    .sort((a, b) => (b.points !== a.points ? b.points - a.points : b.net_run_rate - a.net_run_rate))
    .slice(0, 4);

  return (
    <div className="bc-tile bc-tile-hover md:col-span-4 p-6 overflow-hidden">
      <div className="flex justify-between items-center mb-5">
        <h3 className="bc-label">Points Table</h3>
        <button
          onClick={onViewFull}
          className="text-[10px] text-broadcast-accent font-bold uppercase tracking-widest hover:underline"
        >
          Full Table
        </button>
      </div>
      {top.length === 0 ? (
        <p className="text-sm text-broadcast-muted py-6 text-center">Abhi koi standings nahi</p>
      ) : (
        <table className="w-full text-left">
          <thead className="text-[10px] uppercase text-broadcast-muted font-bold tracking-widest">
            <tr>
              <th className="pb-2">Team</th>
              <th className="pb-2 text-center">P</th>
              <th className="pb-2 text-center">W</th>
              <th className="pb-2 text-right">Pts</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {top.map((row, i) => (
              <tr key={row.id} className="border-t border-broadcast-fg/5">
                <td className="py-3 font-bold text-broadcast-fg">
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <span className="bc-heading text-xs w-4 text-broadcast-accent/70">{i + 1}</span>
                    <span className="truncate max-w-[7rem]">{row.team?.team_name ?? 'Team'}</span>
                  </span>
                </td>
                <td className="text-center text-broadcast-muted">{row.matches_played}</td>
                <td className="text-center text-broadcast-muted">{row.wins}</td>
                <td className="text-right bc-heading text-broadcast-accent">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function FixturesTile({
  matches,
  teams,
  onSelect,
}: {
  matches: Match[];
  teams: Owner[];
  onSelect?: (m: Match) => void;
}) {
  const upcoming = matches
    .filter((m) => m.status === 'scheduled' || m.status === 'live')
    .slice(0, 4);

  const short = (id: string | null) => {
    const t = teams.find((x) => x.id === id);
    return t ? initials(t.team_name) : 'TBD';
  };

  return (
    <div className="bc-tile bc-tile-hover md:col-span-5 p-6">
      <h3 className="bc-label mb-4">Upcoming Fixtures</h3>
      {upcoming.length === 0 ? (
        <p className="text-sm text-broadcast-muted py-6 text-center">Koi fixture schedule nahi hua</p>
      ) : (
        <div className="space-y-3">
          {upcoming.map((m) => (
            <div
              key={m.id}
              onClick={() => onSelect?.(m)}
              className={`p-3 rounded-xl flex items-center justify-between border border-broadcast-fg/5 bg-broadcast-fg/[0.04] hover:border-broadcast-accent/30 transition-all ${
                onSelect ? 'cursor-pointer' : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="text-center leading-tight">
                  <div className="text-xs font-bold text-broadcast-fg">{format(new Date(m.match_date), 'dd')}</div>
                  <div className="text-[9px] uppercase text-broadcast-muted">{format(new Date(m.match_date), 'MMM')}</div>
                </div>
                <div className="h-6 w-px bg-broadcast-fg/10" />
                <div className="text-sm font-bold uppercase tracking-wide truncate text-broadcast-fg">
                  {short(m.team1_id)} <span className="text-broadcast-muted mx-1">v</span> {short(m.team2_id)}
                </div>
              </div>
              <div className="text-[10px] font-medium bg-broadcast-fg/10 px-2 py-1 rounded text-broadcast-fg shrink-0">
                {format(new Date(m.match_date), 'p')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LeadersTile({
  stats,
  players,
}: {
  stats: PlayerMatchStats[];
  players: Player[];
}) {
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Unknown';

  const runs = new Map<string, number>();
  const wickets = new Map<string, number>();
  stats.forEach((s) => {
    runs.set(s.player_id, (runs.get(s.player_id) ?? 0) + s.runs_scored);
    wickets.set(s.player_id, (wickets.get(s.player_id) ?? 0) + s.wickets_taken);
  });

  const best = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).filter(([, v]) => v > 0)[0];

  const topRun = best(runs);
  const topWkt = best(wickets);

  const Row = ({
    label,
    tone,
    entry,
    unit,
    icon: Icon,
  }: {
    label: string;
    tone: string;
    entry?: [string, number];
    unit: string;
    icon: typeof Trophy;
  }) => (
    <div>
      <p className={`text-[9px] uppercase font-bold mb-2 tracking-widest ${tone}`}>{label}</p>
      {entry ? (
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full shrink-0 bg-broadcast-fg/10 border flex items-center justify-center ${tone.replace('text-', 'border-')}/50`}>
            <Icon className={`h-4 w-4 ${tone}`} />
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold truncate text-broadcast-fg">{nameOf(entry[0])}</p>
            <p className="text-xs text-broadcast-muted">
              {entry[1]} {unit}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-broadcast-muted">No data yet</p>
      )}
    </div>
  );

  return (
    <div className="bc-tile bc-tile-hover md:col-span-3 p-6">
      <h3 className="bc-label mb-6">Season Leaders</h3>
      <div className="space-y-6">
        <Row label="Orange Cap" tone="text-broadcast-accent" entry={topRun} unit="Runs" icon={Trophy} />
        <div className="pt-4 border-t border-broadcast-fg/5">
          <Row label="Purple Cap" tone="text-broadcast-accent-2" entry={topWkt} unit="Wickets" icon={Target} />
        </div>
      </div>
    </div>
  );
}

export function TournamentSummaryStrip({
  matchCount,
  teamCount,
  completed,
}: {
  matchCount: number;
  teamCount: number;
  completed: number;
}) {
  const items = [
    { label: 'Matches', value: matchCount, icon: CalendarDays },
    { label: 'Teams', value: teamCount, icon: Users },
    { label: 'Completed', value: completed, icon: Trophy },
  ];
  return (
    <div className="bc-tile md:col-span-12 p-4 grid grid-cols-3 divide-x divide-broadcast-fg/5">
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} className="flex items-center justify-center gap-3">
          <Icon className="h-4 w-4 text-broadcast-accent" />
          <div>
            <p className="bc-heading text-lg leading-none text-broadcast-fg">{value}</p>
            <p className="bc-label">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
