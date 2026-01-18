-- Function to update tournament points when a match is completed
CREATE OR REPLACE FUNCTION public.update_tournament_points_on_match_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_tournament_id UUID;
  v_team1_id UUID;
  v_team2_id UUID;
  v_winner_id UUID;
  v_team1_runs INT;
  v_team1_overs NUMERIC;
  v_team2_runs INT;
  v_team2_overs NUMERIC;
  v_points_for_win INT := 2;
  v_points_for_draw INT := 1;
  v_points_for_loss INT := 0;
BEGIN
  -- Only process when match status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    v_tournament_id := NEW.tournament_id;
    v_team1_id := NEW.team1_id;
    v_team2_id := NEW.team2_id;
    v_winner_id := NEW.winner_id;

    -- Get innings data for team 1 (batting)
    SELECT COALESCE(SUM(total_runs), 0), COALESCE(SUM(total_overs), 0)
    INTO v_team1_runs, v_team1_overs
    FROM public.match_innings
    WHERE match_id = NEW.id AND batting_team_id = v_team1_id;

    -- Get innings data for team 2 (batting)
    SELECT COALESCE(SUM(total_runs), 0), COALESCE(SUM(total_overs), 0)
    INTO v_team2_runs, v_team2_overs
    FROM public.match_innings
    WHERE match_id = NEW.id AND batting_team_id = v_team2_id;

    -- Upsert team 1 points
    INSERT INTO public.tournament_points (tournament_id, team_id, matches_played, wins, losses, draws, points)
    VALUES (
      v_tournament_id,
      v_team1_id,
      1,
      CASE WHEN v_winner_id = v_team1_id THEN 1 ELSE 0 END,
      CASE WHEN v_winner_id = v_team2_id THEN 1 ELSE 0 END,
      CASE WHEN v_winner_id IS NULL THEN 1 ELSE 0 END,
      CASE 
        WHEN v_winner_id = v_team1_id THEN v_points_for_win
        WHEN v_winner_id IS NULL THEN v_points_for_draw
        ELSE v_points_for_loss
      END
    )
    ON CONFLICT (tournament_id, team_id) DO UPDATE SET
      matches_played = tournament_points.matches_played + 1,
      wins = tournament_points.wins + CASE WHEN v_winner_id = v_team1_id THEN 1 ELSE 0 END,
      losses = tournament_points.losses + CASE WHEN v_winner_id = v_team2_id THEN 1 ELSE 0 END,
      draws = tournament_points.draws + CASE WHEN v_winner_id IS NULL THEN 1 ELSE 0 END,
      points = tournament_points.points + CASE 
        WHEN v_winner_id = v_team1_id THEN v_points_for_win
        WHEN v_winner_id IS NULL THEN v_points_for_draw
        ELSE v_points_for_loss
      END,
      updated_at = now();

    -- Upsert team 2 points
    INSERT INTO public.tournament_points (tournament_id, team_id, matches_played, wins, losses, draws, points)
    VALUES (
      v_tournament_id,
      v_team2_id,
      1,
      CASE WHEN v_winner_id = v_team2_id THEN 1 ELSE 0 END,
      CASE WHEN v_winner_id = v_team1_id THEN 1 ELSE 0 END,
      CASE WHEN v_winner_id IS NULL THEN 1 ELSE 0 END,
      CASE 
        WHEN v_winner_id = v_team2_id THEN v_points_for_win
        WHEN v_winner_id IS NULL THEN v_points_for_draw
        ELSE v_points_for_loss
      END
    )
    ON CONFLICT (tournament_id, team_id) DO UPDATE SET
      matches_played = tournament_points.matches_played + 1,
      wins = tournament_points.wins + CASE WHEN v_winner_id = v_team2_id THEN 1 ELSE 0 END,
      losses = tournament_points.losses + CASE WHEN v_winner_id = v_team1_id THEN 1 ELSE 0 END,
      draws = tournament_points.draws + CASE WHEN v_winner_id IS NULL THEN 1 ELSE 0 END,
      points = tournament_points.points + CASE 
        WHEN v_winner_id = v_team2_id THEN v_points_for_win
        WHEN v_winner_id IS NULL THEN v_points_for_draw
        ELSE v_points_for_loss
      END,
      updated_at = now();

    -- Update NRR for team 1
    UPDATE public.tournament_points tp
    SET net_run_rate = (
      SELECT 
        CASE 
          WHEN COALESCE(SUM(overs_faced), 0) > 0 AND COALESCE(SUM(overs_bowled), 0) > 0 THEN
            ROUND(
              (COALESCE(SUM(runs_scored), 0)::numeric / NULLIF(SUM(overs_faced), 0)) -
              (COALESCE(SUM(runs_conceded), 0)::numeric / NULLIF(SUM(overs_bowled), 0)),
              3
            )
          ELSE 0
        END
      FROM (
        SELECT 
          mi.total_runs as runs_scored,
          mi.total_overs as overs_faced,
          mi2.total_runs as runs_conceded,
          mi2.total_overs as overs_bowled
        FROM public.matches m
        JOIN public.match_innings mi ON mi.match_id = m.id AND mi.batting_team_id = v_team1_id
        LEFT JOIN public.match_innings mi2 ON mi2.match_id = m.id AND mi2.bowling_team_id = v_team1_id
        WHERE m.tournament_id = v_tournament_id 
          AND m.status = 'completed'
          AND (m.team1_id = v_team1_id OR m.team2_id = v_team1_id)
      ) stats
    )
    WHERE tp.tournament_id = v_tournament_id AND tp.team_id = v_team1_id;

    -- Update NRR for team 2
    UPDATE public.tournament_points tp
    SET net_run_rate = (
      SELECT 
        CASE 
          WHEN COALESCE(SUM(overs_faced), 0) > 0 AND COALESCE(SUM(overs_bowled), 0) > 0 THEN
            ROUND(
              (COALESCE(SUM(runs_scored), 0)::numeric / NULLIF(SUM(overs_faced), 0)) -
              (COALESCE(SUM(runs_conceded), 0)::numeric / NULLIF(SUM(overs_bowled), 0)),
              3
            )
          ELSE 0
        END
      FROM (
        SELECT 
          mi.total_runs as runs_scored,
          mi.total_overs as overs_faced,
          mi2.total_runs as runs_conceded,
          mi2.total_overs as overs_bowled
        FROM public.matches m
        JOIN public.match_innings mi ON mi.match_id = m.id AND mi.batting_team_id = v_team2_id
        LEFT JOIN public.match_innings mi2 ON mi2.match_id = m.id AND mi2.bowling_team_id = v_team2_id
        WHERE m.tournament_id = v_tournament_id 
          AND m.status = 'completed'
          AND (m.team1_id = v_team2_id OR m.team2_id = v_team2_id)
      ) stats
    )
    WHERE tp.tournament_id = v_tournament_id AND tp.team_id = v_team2_id;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add unique constraint for upsert to work
ALTER TABLE public.tournament_points 
DROP CONSTRAINT IF EXISTS tournament_points_tournament_team_unique;

ALTER TABLE public.tournament_points 
ADD CONSTRAINT tournament_points_tournament_team_unique UNIQUE (tournament_id, team_id);

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_tournament_points ON public.matches;
CREATE TRIGGER trigger_update_tournament_points
AFTER UPDATE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.update_tournament_points_on_match_complete();