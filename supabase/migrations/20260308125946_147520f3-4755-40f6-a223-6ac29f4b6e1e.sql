
-- =============================================
-- FIX 1: Profiles - restrict SELECT to own row only
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- =============================================
-- FIX 2: Remove dangerous owner UPDATE on current_auction
-- Bids are already handled atomically via place_bid_atomic RPC
-- =============================================
DROP POLICY IF EXISTS "Owners can update auction bids" ON public.current_auction;

-- =============================================
-- FIX 3: Fix owners SELECT - non-admins can only see own record
-- =============================================
DROP POLICY IF EXISTS "Scoped view owners" ON public.owners;
CREATE POLICY "Scoped view owners"
  ON public.owners FOR SELECT
  TO authenticated
  USING (
    CASE 
      WHEN has_role(auth.uid(), 'admin'::app_role) THEN created_by = auth.uid()
      ELSE user_id = auth.uid()
    END
  );
