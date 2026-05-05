
-- 1. Fix self-referential bug in owners update policy
DROP POLICY IF EXISTS "Owners can update own team profile" ON public.owners;

CREATE POLICY "Owners can update own team profile"
ON public.owners
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND total_points = (SELECT o.total_points FROM public.owners o WHERE o.id = owners.id)
  AND remaining_points = (SELECT o.remaining_points FROM public.owners o WHERE o.id = owners.id)
  AND user_id = (SELECT o.user_id FROM public.owners o WHERE o.id = owners.id)
  AND created_by IS NOT DISTINCT FROM (SELECT o.created_by FROM public.owners o WHERE o.id = owners.id)
);

-- 2. Update storage policies for player-images to include super admins
DROP POLICY IF EXISTS "Admins can upload player images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update player images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete player images" ON storage.objects;

CREATE POLICY "Admins can upload player images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'player-images' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can update player images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'player-images' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can delete player images"
ON storage.objects FOR DELETE
USING (bucket_id = 'player-images' AND public.is_admin_or_super(auth.uid()));

-- 3. Add baseline RLS on realtime.messages restricting subscriptions to authenticated users
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can receive realtime broadcasts" ON realtime.messages;
CREATE POLICY "Authenticated users can receive realtime broadcasts"
ON realtime.messages FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can send realtime broadcasts" ON realtime.messages;
CREATE POLICY "Authenticated users can send realtime broadcasts"
ON realtime.messages FOR INSERT
TO authenticated
WITH CHECK (true);
