-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create business" ON public.businesses;

-- Recreate as PERMISSIVE (default) INSERT policy
CREATE POLICY "Authenticated users can create business"
ON public.businesses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Also ensure the SELECT and UPDATE policies are PERMISSIVE
DROP POLICY IF EXISTS "Business owners can view own business" ON public.businesses;
DROP POLICY IF EXISTS "Business owners can update own business" ON public.businesses;

CREATE POLICY "Business owners can view own business"
ON public.businesses
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Business owners can update own business"
ON public.businesses
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);