CREATE OR REPLACE FUNCTION public.match_squads_error(p_match_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE m record; c1 int; c2 int; t record;
BEGIN
  SELECT team1_id, team2_id INTO m FROM matches WHERE id = p_match_id;
  IF m IS NULL THEN RETURN 'Match not found'; END IF;
  SELECT count(*) INTO c1 FROM match_squads WHERE match_id = p_match_id AND team_id = m.team1_id;
  SELECT count(*) INTO c2 FROM match_squads WHERE match_id = p_match_id AND team_id = m.team2_id;
  IF c1 < 5 OR c2 < 5 THEN RETURN 'Each team needs at least 5 players in the playing squad'; END IF;
  IF c1 <> c2 THEN RETURN format('Squads must be equal (%s vs %s)', c1, c2); END IF;
  FOR t IN SELECT unnest(ARRAY[m.team1_id, m.team2_id]) AS tid LOOP
    IF (SELECT count(*) FROM match_squads WHERE match_id = p_match_id AND team_id = t.tid AND squad_role = 'captain') <> 1
      OR (SELECT count(*) FROM match_squads WHERE match_id = p_match_id AND team_id = t.tid AND squad_role = 'vice_captain') <> 1 THEN
      RETURN 'Each team needs exactly one captain and one vice-captain';
    END IF;
  END LOOP;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.save_match_squads(p_match_id uuid, p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record; err text; max1 int; max2 int; n int;
BEGIN
  IF NOT public.is_admin_or_super(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO m FROM matches WHERE id = p_match_id;
  IF m IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF m.status = 'completed' THEN RAISE EXCEPTION 'Completed matches are read-only'; END IF;
  IF EXISTS (SELECT 1 FROM match_innings WHERE match_id = p_match_id) THEN
    RAISE EXCEPTION 'Squads are locked once the match has started';
  END IF;
  -- every row must belong to one of the two teams and the player must be on that team's roster
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_rows) r(team_id uuid, player_id uuid, squad_role text)
    WHERE r.team_id NOT IN (m.team1_id, m.team2_id)
       OR (r.squad_role IS NOT NULL AND r.squad_role NOT IN ('captain','vice_captain'))
       OR NOT EXISTS (SELECT 1 FROM team_players tp WHERE tp.owner_id = r.team_id AND tp.player_id = r.player_id)
  ) THEN RAISE EXCEPTION 'Invalid squad: players must belong to their team roster'; END IF;
  SELECT count(*) INTO max1 FROM team_players WHERE owner_id = m.team1_id;
  SELECT count(*) INTO max2 FROM team_players WHERE owner_id = m.team2_id;
  SELECT count(*) INTO n FROM jsonb_to_recordset(p_rows) r(team_id uuid) WHERE r.team_id = m.team1_id;
  IF n > LEAST(max1, max2, 11) THEN RAISE EXCEPTION 'Squad size cannot exceed the smaller roster (%)', LEAST(max1, max2, 11); END IF;

  DELETE FROM match_squads WHERE match_id = p_match_id;
  INSERT INTO match_squads (match_id, team_id, player_id, squad_role)
  SELECT p_match_id, r.team_id, r.player_id, r.squad_role
  FROM jsonb_to_recordset(p_rows) r(team_id uuid, player_id uuid, squad_role text);
  err := public.match_squads_error(p_match_id);
  IF err IS NOT NULL THEN RAISE EXCEPTION '%', err; END IF;
  RETURN jsonb_build_object('success', true);
END $$;

REVOKE EXECUTE ON FUNCTION public.save_match_squads(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_match_squads(uuid, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.match_squads_error(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_squads_error(uuid) TO authenticated;

-- squads can now only be written through save_match_squads
DROP POLICY IF EXISTS "Admins manage playing squads" ON public.match_squads;

CREATE OR REPLACE FUNCTION public.enforce_squads_before_start()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE err text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM match_innings WHERE match_id = NEW.match_id) THEN
    err := public.match_squads_error(NEW.match_id);
    IF err IS NOT NULL THEN RAISE EXCEPTION 'Cannot start match: %', err; END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_squads_before_start() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS enforce_squads_before_start ON public.match_innings;
CREATE TRIGGER enforce_squads_before_start BEFORE INSERT ON public.match_innings
FOR EACH ROW EXECUTE FUNCTION public.enforce_squads_before_start();

CREATE TABLE public.site_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  font_family text,
  heading_font text,
  text_color text,
  primary_color text,
  font_size integer CHECK (font_size BETWEEN 12 AND 22),
  site_name text,
  logo_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view site settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins insert site settings" ON public.site_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins update site settings" ON public.site_settings FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
INSERT INTO public.site_settings (id) VALUES (true);
ALTER TABLE public.site_settings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;