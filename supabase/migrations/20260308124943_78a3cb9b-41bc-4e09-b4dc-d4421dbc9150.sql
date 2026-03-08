
-- Add created_by column to players, owners, and current_auction tables
ALTER TABLE public.players ADD COLUMN created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.owners ADD COLUMN created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.current_auction ADD COLUMN created_by uuid REFERENCES auth.users(id);

-- Drop existing admin policies on players
DROP POLICY IF EXISTS "Admins can manage players" ON public.players;
DROP POLICY IF EXISTS "Anyone can view players" ON public.players;

-- New SELECT policy: admins see only their own players, others see all
CREATE POLICY "Scoped view players"
  ON public.players FOR SELECT
  TO authenticated
  USING (
    CASE 
      WHEN has_role(auth.uid(), 'admin'::app_role) THEN created_by = auth.uid()
      ELSE true
    END
  );

-- Admin INSERT: must set created_by to self
CREATE POLICY "Admins can insert own players"
  ON public.players FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND created_by = auth.uid());

-- Admin UPDATE: only own players
CREATE POLICY "Admins can update own players"
  ON public.players FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND created_by = auth.uid());

-- Admin DELETE: only own players
CREATE POLICY "Admins can delete own players"
  ON public.players FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND created_by = auth.uid());

-- Drop existing admin policies on owners
DROP POLICY IF EXISTS "Admins can manage owners" ON public.owners;
DROP POLICY IF EXISTS "Authenticated users can view owners" ON public.owners;
DROP POLICY IF EXISTS "Owners can update own data" ON public.owners;

-- New SELECT policy for owners: admins see only their own, others see all
CREATE POLICY "Scoped view owners"
  ON public.owners FOR SELECT
  TO authenticated
  USING (
    CASE 
      WHEN has_role(auth.uid(), 'admin'::app_role) THEN created_by = auth.uid()
      ELSE true
    END
  );

-- Admin INSERT owners
CREATE POLICY "Admins can insert own owners"
  ON public.owners FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND created_by = auth.uid());

-- Admin UPDATE own owners
CREATE POLICY "Admins can update own owners"
  ON public.owners FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND created_by = auth.uid());

-- Admin DELETE own owners
CREATE POLICY "Admins can delete own owners"
  ON public.owners FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND created_by = auth.uid());

-- Owner can update own data (keep existing behavior)
CREATE POLICY "Owners can update own data"
  ON public.owners FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Drop existing admin policy on current_auction
DROP POLICY IF EXISTS "Admins can manage auction" ON public.current_auction;
DROP POLICY IF EXISTS "Anyone can view current auction" ON public.current_auction;
DROP POLICY IF EXISTS "Owners can update auction bids" ON public.current_auction;

-- Scoped auction policies
CREATE POLICY "Scoped view auction"
  ON public.current_auction FOR SELECT
  TO authenticated
  USING (
    CASE 
      WHEN has_role(auth.uid(), 'admin'::app_role) THEN created_by = auth.uid()
      ELSE true
    END
  );

CREATE POLICY "Admins can insert own auction"
  ON public.current_auction FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND created_by = auth.uid());

CREATE POLICY "Admins can update own auction"
  ON public.current_auction FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND created_by = auth.uid());

CREATE POLICY "Admins can delete own auction"
  ON public.current_auction FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND created_by = auth.uid());

CREATE POLICY "Owners can update auction bids"
  ON public.current_auction FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role));
