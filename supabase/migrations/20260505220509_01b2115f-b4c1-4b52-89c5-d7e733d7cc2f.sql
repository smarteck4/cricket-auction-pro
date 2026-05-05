
-- 1. Replace overly-permissive owner self-update policy
DROP POLICY IF EXISTS "Owners can update own data" ON public.owners;

CREATE POLICY "Owners can update own team profile"
ON public.owners
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND total_points = (SELECT total_points FROM public.owners WHERE id = owners.id)
  AND remaining_points = (SELECT remaining_points FROM public.owners WHERE id = owners.id)
  AND user_id = (SELECT user_id FROM public.owners WHERE id = owners.id)
  AND created_by IS NOT DISTINCT FROM (SELECT created_by FROM public.owners WHERE id = owners.id)
);

-- 2. Restrict SELECT so non-admins only see their own owner row
DROP POLICY IF EXISTS "Scoped view owners" ON public.owners;

CREATE POLICY "Scoped view owners"
ON public.owners
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN has_role(auth.uid(), 'super_admin'::app_role) THEN true
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN (created_by = auth.uid())
    WHEN has_role(auth.uid(), 'owner'::app_role) THEN (user_id = auth.uid())
    ELSE false
  END
);
