-- Offer/AI/Availability enhancements

-- 1) Offer payment method + guest decision
ALTER TABLE public.offers
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'pay_at_property'
CHECK (payment_method IN ('pay_at_property','pay_now')),
ADD COLUMN IF NOT EXISTS guest_decision_status text DEFAULT 'pending'
CHECK (guest_decision_status IN ('pending','accepted','declined')),
ADD COLUMN IF NOT EXISTS guest_decision_at timestamptz;

-- 2) Offer invite tracking (unclaimed properties)
ALTER TABLE public.offers
ADD COLUMN IF NOT EXISTS unclaimed_invite_sent boolean DEFAULT false;

-- 3) Room pricing (estimated vs actual)
ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS avg_rate numeric,
ADD COLUMN IF NOT EXISTS actual_rate numeric,
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'NZD';

-- 4) Availability blocks + bookings
CREATE TABLE IF NOT EXISTS public.room_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'blocked' CHECK (status IN ('blocked','booked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_blocks_room_id ON public.room_blocks(room_id);
CREATE INDEX IF NOT EXISTS idx_room_blocks_dates ON public.room_blocks(start_date, end_date);

ALTER TABLE public.room_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business can manage room blocks for own properties"
ON public.room_blocks
FOR ALL
USING (
  room_id IN (
    SELECT r.id FROM public.rooms r
    JOIN public.properties p ON r.property_id = p.id
    JOIN public.businesses b ON p.business_id = b.id
    WHERE b.user_id = auth.uid()
  )
);

CREATE POLICY "Guests cannot modify room blocks"
ON public.room_blocks
FOR SELECT
TO authenticated
USING (true);

-- 5) Property scores + events (learning rank)
CREATE TABLE IF NOT EXISTS public.property_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_events_property_id ON public.property_events(property_id);
CREATE INDEX IF NOT EXISTS idx_property_events_event_type ON public.property_events(event_type);
CREATE INDEX IF NOT EXISTS idx_property_events_created_at ON public.property_events(created_at);

ALTER TABLE public.property_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert property events"
ON public.property_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own events"
ON public.property_events
FOR SELECT
USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.property_scores (
  property_id uuid PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  score numeric NOT NULL DEFAULT 0,
  signals jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.property_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view property scores"
ON public.property_scores
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can update property scores"
ON public.property_scores
FOR ALL
USING (public.is_admin());

-- 6) Business verification + disputes
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'pending'
CHECK (verification_status IN ('pending','verified','disputed','rejected')),
ADD COLUMN IF NOT EXISTS verified_at timestamptz,
ADD COLUMN IF NOT EXISTS verification_method text,
ADD COLUMN IF NOT EXISTS dispute_reason text;

CREATE TABLE IF NOT EXISTS public.property_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  claimant_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.property_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create claims"
ON public.property_claims
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = claimant_user_id);

CREATE POLICY "Users can view own claims"
ON public.property_claims
FOR SELECT
USING (auth.uid() = claimant_user_id);

-- 7) Offer limit enforcement (5 active offers per city per 2 hours)
CREATE OR REPLACE FUNCTION public.enforce_offer_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  offer_city text;
  active_count integer;
BEGIN
  -- Determine city for the property
  SELECT p.city INTO offer_city
  FROM public.properties p
  WHERE p.id = NEW.property_id;

  IF offer_city IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO active_count
  FROM public.offers o
  JOIN public.properties p ON p.id = o.property_id
  WHERE o.guest_user_id = NEW.guest_user_id
    AND p.city = offer_city
    AND o.created_at >= (now() - interval '2 hours')
    AND o.status IN ('submitted','pending','countered','accepted');

  IF active_count >= 5 THEN
    RAISE EXCEPTION 'Offer limit reached for this city. Please wait before submitting more offers.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_offer_limit ON public.offers;
CREATE TRIGGER trg_enforce_offer_limit
BEFORE INSERT ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.enforce_offer_limit();

-- 8) Updated_at triggers for new tables
CREATE TRIGGER update_room_blocks_updated_at
BEFORE UPDATE ON public.room_blocks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
