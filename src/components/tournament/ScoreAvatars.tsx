import { Player, Owner } from '@/lib/types';
import { getRealTeam } from '@/lib/real-teams';

const initials = (name?: string | null) =>
  (name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

export function PlayerAvatar({
  player,
  size = 28,
  className = '',
}: {
  player?: Player | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size };
  return (
    <span
      style={style}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted border border-border/60 ${className}`}
    >
      {player?.profile_picture_url ? (
        <img
          src={player.profile_picture_url}
          alt={`${player.name} photo`}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-[9px] font-bold text-muted-foreground">{initials(player?.name)}</span>
      )}
    </span>
  );
}

export function TeamLogo({
  team,
  size = 28,
  className = '',
}: {
  team?: Owner | null;
  size?: number;
  className?: string;
}) {
  const real = getRealTeam(team?.real_team_key);
  const style = real
    ? { width: size, height: size, background: real.color, color: real.accent, borderColor: real.accent }
    : { width: size, height: size };
  return (
    <span
      style={style}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 border border-white/25 ${className}`}
    >
      {team?.team_logo_url ? (
        <img
          src={team.team_logo_url}
          alt={`${team.team_name} logo`}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-[9px] font-bold">{real?.shortCode ?? team?.team_short_code ?? initials(team?.team_name)}</span>
      )}
    </span>
  );
}

export function PlayerNameCell({
  player,
  name,
  size = 26,
  bold = true,
}: {
  player?: Player | null;
  name?: string;
  size?: number;
  bold?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <PlayerAvatar player={player} size={size} />
      <span className={`truncate ${bold ? 'font-semibold' : ''}`}>{player?.name ?? name ?? 'Unknown'}</span>
    </span>
  );
}
