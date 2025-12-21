-- Add last_message_at column to conversations table for ordering
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create function to auto-update last_message_at when messages are inserted
CREATE OR REPLACE FUNCTION public.update_conversation_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations 
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to update last_message_at on new messages
DROP TRIGGER IF EXISTS update_conversation_last_message_at_trigger ON public.messages;
CREATE TRIGGER update_conversation_last_message_at_trigger
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_last_message_at();

-- Allow participants to update message read status
CREATE POLICY "Participants can update message read status" 
ON public.messages 
FOR UPDATE 
USING (
  conversation_id IN (
    SELECT id FROM conversations 
    WHERE (guest_user_id = auth.uid() OR business_user_id = auth.uid()) 
    AND is_unlocked = true
  )
)
WITH CHECK (
  conversation_id IN (
    SELECT id FROM conversations 
    WHERE (guest_user_id = auth.uid() OR business_user_id = auth.uid()) 
    AND is_unlocked = true
  )
);