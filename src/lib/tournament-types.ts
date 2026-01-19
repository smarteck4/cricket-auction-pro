export type MatchFormat = 'T5' | 'T10' | 'T20' | 'ODI' | 'Custom';
export type MatchStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';
export type TournamentStatus = 'upcoming' | 'ongoing' | 'completed';

export interface Tournament {
  id: string;
  name: string;
  format: MatchFormat;
  overs_per_innings: number;
  start_date: string;
  end_date: string;
  venue: string | null;
  status: TournamentStatus;
  created_at: string;
  updated_at: string;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  country: string;
  capacity: number | null;
  created_at: string;
}

export interface Match {
  id: string;
  tournament_id: string;
  team1_id: string | null;
  team2_id: string | null;
  venue_id: string | null;
  match_date: string;
  format: MatchFormat;
  overs_per_innings: number;
  status: MatchStatus;
  toss_winner_id: string | null;
  toss_decision: string | null;
  winner_id: string | null;
  created_at: string;
  updated_at: string;
  tournament?: Tournament;
  team1?: { id: string; team_name: string; team_logo_url: string | null };
  team2?: { id: string; team_name: string; team_logo_url: string | null };
  venue?: Venue;
}

export interface MatchInnings {
  id: string;
  match_id: string;
  batting_team_id: string;
  bowling_team_id: string;
  innings_number: number;
  total_runs: number;
  total_wickets: number;
  total_overs: number;
  extras: number;
  is_completed: boolean;
  created_at: string;
}

export interface MatchBall {
  id: string;
  innings_id: string;
  over_number: number;
  ball_number: number;
  batsman_id: string | null;
  bowler_id: string | null;
  runs_scored: number;
  extras: number;
  extra_type: string | null;
  is_wicket: boolean;
  wicket_type: string | null;
  fielder_id: string | null;
  created_at: string;
}

export interface PlayerMatchStats {
  id: string;
  match_id: string;
  player_id: string;
  team_id: string;
  runs_scored: number;
  balls_faced: number;
  fours: number;
  sixes: number;
  overs_bowled: number;
  runs_conceded: number;
  wickets_taken: number;
  maidens: number;
  catches: number;
  run_outs: number;
  stumpings: number;
  created_at: string;
}

export interface TournamentPoints {
  id: string;
  tournament_id: string;
  team_id: string;
  matches_played: number;
  wins: number;
  losses: number;
  draws: number;
  no_results: number;
  points: number;
  net_run_rate: number;
  created_at: string;
  updated_at: string;
  team?: { id: string; team_name: string; team_logo_url: string | null };
}

export const FORMAT_OVERS: Record<MatchFormat, number> = {
  T5: 5,
  T10: 10,
  T20: 20,
  ODI: 50,
  Custom: 20,
};

export const FORMAT_LABELS: Record<MatchFormat, string> = {
  T5: 'T5 (5 Overs)',
  T10: 'T10 (10 Overs)',
  T20: 'T20 (20 Overs)',
  ODI: 'One Day (50 Overs)',
  Custom: 'Custom Format',
};

export const STATUS_COLORS: Record<MatchStatus, { bg: string; text: string }> = {
  scheduled: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
  live: { bg: 'bg-green-500/10', text: 'text-green-500' },
  completed: { bg: 'bg-muted/50', text: 'text-muted-foreground' },
  cancelled: { bg: 'bg-destructive/10', text: 'text-destructive' },
};

export const TOURNAMENT_STATUS_COLORS: Record<TournamentStatus, { bg: string; text: string }> = {
  upcoming: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
  ongoing: { bg: 'bg-green-500/10', text: 'text-green-500' },
  completed: { bg: 'bg-muted/50', text: 'text-muted-foreground' },
};
