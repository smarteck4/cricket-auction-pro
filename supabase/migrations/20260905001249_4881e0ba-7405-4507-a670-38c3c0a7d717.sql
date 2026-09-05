ALTER TABLE public.owners
  ADD COLUMN IF NOT EXISTS real_team_key text,
  ADD COLUMN IF NOT EXISTS team_short_code text,
  ADD COLUMN IF NOT EXISTS captain_id uuid REFERENCES public.players(id) ON DELETE SET NULL;