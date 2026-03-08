
-- 1. Server-side input validation constraints using triggers (not CHECK for time-based)

-- Players table constraints
ALTER TABLE public.players
  ADD CONSTRAINT players_name_length CHECK (length(name) >= 1 AND length(name) <= 100),
  ADD CONSTRAINT players_nationality_length CHECK (length(nationality) >= 1 AND length(nationality) <= 50),
  ADD CONSTRAINT players_age_range CHECK (age >= 10 AND age <= 60),
  ADD CONSTRAINT players_matches_non_negative CHECK (total_matches >= 0),
  ADD CONSTRAINT players_runs_non_negative CHECK (total_runs >= 0),
  ADD CONSTRAINT players_strike_rate_reasonable CHECK (strike_rate >= 0 AND strike_rate <= 1000),
  ADD CONSTRAINT players_economy_rate_reasonable CHECK (economy_rate >= 0 AND economy_rate <= 50),
  ADD CONSTRAINT players_wickets_non_negative CHECK (wickets >= 0),
  ADD CONSTRAINT players_fifties_non_negative CHECK (fifties >= 0),
  ADD CONSTRAINT players_centuries_non_negative CHECK (centuries >= 0);

-- Owners table constraints
ALTER TABLE public.owners
  ADD CONSTRAINT owners_team_name_length CHECK (length(team_name) >= 1 AND length(team_name) <= 100),
  ADD CONSTRAINT owners_points_non_negative CHECK (total_points >= 0 AND remaining_points >= 0),
  ADD CONSTRAINT owners_remaining_lte_total CHECK (remaining_points <= total_points);

-- 2. Fix bids table - restrict to authenticated users
DROP POLICY IF EXISTS "Anyone can view bids" ON public.bids;
CREATE POLICY "Authenticated users can view bids"
  ON public.bids FOR SELECT
  TO authenticated
  USING (true);

-- 3. Fix team_players table - restrict to authenticated users
DROP POLICY IF EXISTS "Anyone can view team players" ON public.team_players;
CREATE POLICY "Authenticated users can view team players"
  ON public.team_players FOR SELECT
  TO authenticated
  USING (true);

-- 4. Update storage bucket with file size and type limits
UPDATE storage.buckets 
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'player-images';
