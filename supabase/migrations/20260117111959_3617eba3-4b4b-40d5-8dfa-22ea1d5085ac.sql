-- Create match format enum
CREATE TYPE public.match_format AS ENUM ('T10', 'T20', 'ODI', 'Test');

-- Create match status enum
CREATE TYPE public.match_status AS ENUM ('scheduled', 'live', 'completed', 'cancelled');

-- Create tournament status enum
CREATE TYPE public.tournament_status AS ENUM ('upcoming', 'ongoing', 'completed');

-- Create tournaments table
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  format match_format NOT NULL,
  overs_per_innings INTEGER NOT NULL DEFAULT 20,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  venue TEXT,
  status tournament_status NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create venues table
CREATE TABLE public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  capacity INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create matches table
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  team1_id UUID REFERENCES public.owners(id) ON DELETE SET NULL,
  team2_id UUID REFERENCES public.owners(id) ON DELETE SET NULL,
  venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  match_date TIMESTAMP WITH TIME ZONE NOT NULL,
  format match_format NOT NULL,
  overs_per_innings INTEGER NOT NULL,
  status match_status NOT NULL DEFAULT 'scheduled',
  toss_winner_id UUID REFERENCES public.owners(id) ON DELETE SET NULL,
  toss_decision TEXT,
  winner_id UUID REFERENCES public.owners(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create match innings table
CREATE TABLE public.match_innings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  batting_team_id UUID REFERENCES public.owners(id) ON DELETE SET NULL NOT NULL,
  bowling_team_id UUID REFERENCES public.owners(id) ON DELETE SET NULL NOT NULL,
  innings_number INTEGER NOT NULL CHECK (innings_number IN (1, 2, 3, 4)),
  total_runs INTEGER NOT NULL DEFAULT 0,
  total_wickets INTEGER NOT NULL DEFAULT 0,
  total_overs NUMERIC(5,1) NOT NULL DEFAULT 0,
  extras INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create ball-by-ball scoring table
CREATE TABLE public.match_balls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  innings_id UUID REFERENCES public.match_innings(id) ON DELETE CASCADE NOT NULL,
  over_number INTEGER NOT NULL,
  ball_number INTEGER NOT NULL,
  batsman_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  bowler_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  runs_scored INTEGER NOT NULL DEFAULT 0,
  extras INTEGER NOT NULL DEFAULT 0,
  extra_type TEXT,
  is_wicket BOOLEAN NOT NULL DEFAULT false,
  wicket_type TEXT,
  fielder_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create player match stats table
CREATE TABLE public.player_match_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES public.owners(id) ON DELETE SET NULL NOT NULL,
  runs_scored INTEGER NOT NULL DEFAULT 0,
  balls_faced INTEGER NOT NULL DEFAULT 0,
  fours INTEGER NOT NULL DEFAULT 0,
  sixes INTEGER NOT NULL DEFAULT 0,
  overs_bowled NUMERIC(5,1) NOT NULL DEFAULT 0,
  runs_conceded INTEGER NOT NULL DEFAULT 0,
  wickets_taken INTEGER NOT NULL DEFAULT 0,
  maidens INTEGER NOT NULL DEFAULT 0,
  catches INTEGER NOT NULL DEFAULT 0,
  run_outs INTEGER NOT NULL DEFAULT 0,
  stumpings INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(match_id, player_id)
);

-- Create points table
CREATE TABLE public.tournament_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES public.owners(id) ON DELETE CASCADE NOT NULL,
  matches_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  no_results INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  net_run_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tournament_id, team_id)
);

-- Enable RLS on all tables
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_innings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_balls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_points ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tournaments
CREATE POLICY "Anyone can view tournaments" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Admins can manage tournaments" ON public.tournaments FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for venues
CREATE POLICY "Anyone can view venues" ON public.venues FOR SELECT USING (true);
CREATE POLICY "Admins can manage venues" ON public.venues FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for matches
CREATE POLICY "Anyone can view matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Admins can manage matches" ON public.matches FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for match_innings
CREATE POLICY "Anyone can view innings" ON public.match_innings FOR SELECT USING (true);
CREATE POLICY "Admins can manage innings" ON public.match_innings FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for match_balls
CREATE POLICY "Anyone can view balls" ON public.match_balls FOR SELECT USING (true);
CREATE POLICY "Admins can manage balls" ON public.match_balls FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for player_match_stats
CREATE POLICY "Anyone can view player stats" ON public.player_match_stats FOR SELECT USING (true);
CREATE POLICY "Admins can manage player stats" ON public.player_match_stats FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for tournament_points
CREATE POLICY "Anyone can view points table" ON public.tournament_points FOR SELECT USING (true);
CREATE POLICY "Admins can manage points" ON public.tournament_points FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Enable realtime for live scoring
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_innings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_balls;