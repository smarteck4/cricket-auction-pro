import { MatchBall, MatchInnings } from '@/lib/tournament-types';
import { Player, Owner } from '@/lib/types';
import { PlayerAvatar, TeamLogo } from './ScoreAvatars';
import { Badge } from '@/components/ui/badge';

interface MatchSquadsProps {
  team1: Owner;
  team2: Owner;
  team1Players: Player[];
  team2Players: Player[];
  innings: MatchInnings[];
  allBalls: MatchBall[][];
}

const ROLE_LABEL: Record<string, string> = {
  batsman: 'Batter',
  bowler: 'Bowler',
  all_rounder: 'All-rounder',
  wicket_keeper: 'Wicket-keeper',
};

export function MatchSquads({
  team1,
  team2,
  team1Players,
  team2Players,
  innings,
  allBalls,
}: MatchSquadsProps) {
  const batted = new Set<string>();
  const bowled = new Set<string>();
  allBalls.flat().forEach((b) => {
    if (b.batsman_id) batted.add(b.batsman_id);
    if (b.bowler_id) bowled.add(b.bowler_id);
  });

  const renderTeam = (team: Owner, players: Player[]) => (
    <div className="rounded-xl border border-border/40 overflow-hidden">
      <div className="flex items-center justify-between gap-2 bg-muted/40 px-3 py-2.5">
        <span className="inline-flex items-center gap-2 min-w-0">
          <TeamLogo team={team} size={26} />
          <span className="truncate text-sm font-bold">{team.team_name}</span>
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {players.length} players
        </span>
      </div>
      <div className="divide-y divide-border/40">
        {players.length === 0 && (
          <p className="px-3 py-5 text-center text-sm text-muted-foreground">No squad assigned</p>
        )}
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-2.5 px-3 py-2">
            <PlayerAvatar player={p} size={30} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{p.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {ROLE_LABEL[p.player_role] || p.player_role} · {p.batting_hand === 'left' ? 'LHB' : 'RHB'}
                {p.nationality ? ` · ${p.nationality}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              {batted.has(p.id) && (
                <Badge variant="secondary" className="text-[10px]">Batted</Badge>
              )}
              {bowled.has(p.id) && (
                <Badge variant="outline" className="text-[10px]">Bowled</Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {renderTeam(team1, team1Players)}
      {renderTeam(team2, team2Players)}
    </div>
  );
}
