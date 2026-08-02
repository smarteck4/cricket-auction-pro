DROP POLICY IF EXISTS "Scoped view owners" ON public.owners;

CREATE POLICY "Scoped view owners"
ON public.owners
FOR SELECT
USING (
  CASE
    WHEN public.is_admin_or_super(auth.uid()) THEN true
    WHEN public.has_role(auth.uid(), 'owner'::app_role) THEN (user_id = auth.uid())
    ELSE false
  END
);