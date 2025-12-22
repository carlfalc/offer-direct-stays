-- Create watchlists table for saved properties
CREATE TABLE public.watchlists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, property_id)
);

-- Enable RLS
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;

-- Users can view their own watchlist items
CREATE POLICY "Users can view own watchlist"
  ON public.watchlists FOR SELECT
  USING (auth.uid() = user_id);

-- Users can add to their own watchlist
CREATE POLICY "Users can add to own watchlist"
  ON public.watchlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove from their own watchlist
CREATE POLICY "Users can remove from own watchlist"
  ON public.watchlists FOR DELETE
  USING (auth.uid() = user_id);

-- Add currency column to offers if not exists (for storing NZD/AUD)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'offers' AND column_name = 'currency') THEN
    ALTER TABLE public.offers ADD COLUMN currency text DEFAULT 'NZD';
  END IF;
END $$;