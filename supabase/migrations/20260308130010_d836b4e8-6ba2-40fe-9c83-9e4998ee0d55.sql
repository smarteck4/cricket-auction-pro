
-- Fix owners SELECT - auction requires all owners to be visible to authenticated users
-- Financial data (remaining_points) is needed for the owner's own team display
DROP POLICY IF EXISTS "Scoped view owners" ON public.owners;

-- Admins see only their created owners; all other authenticated users can see all owners
-- (required for auction team display, bid history, etc.)
CREATE POLICY "Scoped view owners"
  ON public.owners FOR SELECT
  TO authenticated
  USING (
    CASE 
      WHEN has_role(auth.uid(), 'admin'::app_role) THEN created_by = auth.uid()
      ELSE true
    END
  );
