-- Add business_id column to conversations for easier business filtering
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id);

-- Update conversations RLS to allow SELECT even when locked (read-only viewing)
-- and add fallback for business_id matching
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations" 
ON public.conversations 
FOR SELECT 
USING (
  auth.uid() = guest_user_id 
  OR auth.uid() = business_user_id
  OR business_id IN (
    SELECT id FROM businesses WHERE user_id = auth.uid()
  )
);

-- Update messages SELECT policy to allow viewing messages even when locked
-- (participants can see message history but can't send until unlocked)
DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages" 
ON public.messages 
FOR SELECT 
USING (
  conversation_id IN (
    SELECT id FROM conversations 
    WHERE guest_user_id = auth.uid() 
    OR business_user_id = auth.uid()
    OR business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  )
);

-- Messages INSERT policy remains requiring is_unlocked = true (already correct)
-- No change needed for INSERT policy