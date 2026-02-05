-- Add fifties and centuries columns to players table
ALTER TABLE public.players 
ADD COLUMN fifties integer NOT NULL DEFAULT 0,
ADD COLUMN centuries integer NOT NULL DEFAULT 0;

-- Update the trigger function to track fifties and centuries
CREATE OR REPLACE FUNCTION public.update_player_career_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  player_stats RECORD;
  best_bowling_figures TEXT;
  best_wickets INT;
  best_runs_conceded INT;
  fifties_count INT;
  centuries_count INT;
BEGIN
  -- Aggregate all match stats for this player
  SELECT 
    COUNT(DISTINCT match_id) as total_matches,
    COALESCE(SUM(runs_scored), 0) as total_runs,
    COALESCE(MAX(runs_scored), 0) as highest_score,
    CASE 
      WHEN SUM(balls_faced) > 0 THEN ROUND((SUM(runs_scored)::numeric / SUM(balls_faced)) * 100, 2)
      ELSE 0 
    END as strike_rate,
    COALESCE(SUM(wickets_taken), 0) as total_wickets,
    CASE 
      WHEN SUM(wickets_taken) > 0 THEN ROUND(SUM(runs_conceded)::numeric / SUM(wickets_taken), 2)
      ELSE 0 
    END as bowling_average,
    CASE 
      WHEN SUM(overs_bowled) > 0 THEN ROUND(SUM(runs_conceded)::numeric / SUM(overs_bowled), 2)
      ELSE 0 
    END as economy_rate
  INTO player_stats
  FROM public.player_match_stats
  WHERE player_id = NEW.player_id;

  -- Count fifties (50-99 runs in a match)
  SELECT COUNT(*)
  INTO fifties_count
  FROM public.player_match_stats
  WHERE player_id = NEW.player_id 
    AND runs_scored >= 50 
    AND runs_scored < 100;

  -- Count centuries (100+ runs in a match)
  SELECT COUNT(*)
  INTO centuries_count
  FROM public.player_match_stats
  WHERE player_id = NEW.player_id 
    AND runs_scored >= 100;

  -- Find best bowling figures (most wickets, least runs)
  SELECT wickets_taken, runs_conceded
  INTO best_wickets, best_runs_conceded
  FROM public.player_match_stats
  WHERE player_id = NEW.player_id AND wickets_taken > 0
  ORDER BY wickets_taken DESC, runs_conceded ASC
  LIMIT 1;

  IF best_wickets IS NOT NULL AND best_wickets > 0 THEN
    best_bowling_figures := best_wickets || '/' || best_runs_conceded;
  ELSE
    best_bowling_figures := NULL;
  END IF;

  -- Update the player's career statistics
  UPDATE public.players
  SET 
    total_matches = player_stats.total_matches,
    total_runs = player_stats.total_runs,
    highest_score = player_stats.highest_score,
    strike_rate = player_stats.strike_rate,
    wickets = player_stats.total_wickets,
    bowling_average = player_stats.bowling_average,
    economy_rate = player_stats.economy_rate,
    best_bowling = COALESCE(best_bowling_figures, best_bowling),
    fifties = fifties_count,
    centuries = centuries_count,
    updated_at = now()
  WHERE id = NEW.player_id;

  RETURN NEW;
END;
$function$;