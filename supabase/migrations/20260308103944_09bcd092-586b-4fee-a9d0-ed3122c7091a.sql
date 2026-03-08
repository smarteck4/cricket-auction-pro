CREATE TRIGGER on_player_match_stats_upsert
  AFTER INSERT OR UPDATE ON public.player_match_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_player_career_stats();