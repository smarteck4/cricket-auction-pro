-- 1. Revoke EXECUTE on internal SECURITY DEFINER trigger/automation functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.update_player_career_stats() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.update_tournament_points_on_match_complete() FROM anon, authenticated, public;

-- 2. Storage: prevent listing of the player-images bucket
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND cmd IN ('SELECT','ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Admins can list player images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'player-images' AND public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins can list player images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload player images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update player images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete player images" ON storage.objects;

CREATE POLICY "Admins can upload player images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'player-images' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can update player images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'player-images' AND public.is_admin_or_super(auth.uid()))
WITH CHECK (bucket_id = 'player-images' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can delete player images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'player-images' AND public.is_admin_or_super(auth.uid()));

-- 3. Realtime: topic-scoped broadcast policies
DROP POLICY IF EXISTS "Authenticated users can receive realtime broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send realtime broadcasts" ON realtime.messages;

CREATE POLICY "Scoped realtime receive"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() LIKE 'auction%'
  OR realtime.topic() LIKE 'match%'
  OR realtime.topic() LIKE 'tournament%'
  OR realtime.topic() = 'user:' || auth.uid()::text
);

CREATE POLICY "Scoped realtime send"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  (
    realtime.topic() LIKE 'auction%'
    OR realtime.topic() LIKE 'match%'
  ) AND public.is_admin_or_super(auth.uid())
  OR realtime.topic() = 'user:' || auth.uid()::text
);