CREATE TABLE public.match_squads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, player_id)
);

CREATE INDEX idx_match_squads_match ON public.match_squads(match_id);

GRANT SELECT ON public.match_squads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_squads TO authenticated;
GRANT ALL ON public.match_squads TO service_role;

ALTER TABLE public.match_squads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view playing squads"
ON public.match_squads FOR SELECT
USING (true);

CREATE POLICY "Admins manage playing squads"
ON public.match_squads FOR ALL
TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.match_squads;