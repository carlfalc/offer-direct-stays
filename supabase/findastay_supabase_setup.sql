-- ============================================================
-- findastay — full database setup for a NEW Supabase project
-- Paste this whole file into: Supabase → SQL Editor → New query → Run
-- Safe to run once on a fresh project. Generated 2026-10-17
-- ============================================================


-- ---------- 20251220104228_55e94e4f-731c-4194-b24e-10f5da04cb7c.sql ----------
-- Create enum types
CREATE TYPE public.app_role AS ENUM ('guest', 'business');
CREATE TYPE public.offer_status AS ENUM ('pending', 'accepted', 'countered', 'declined', 'cancelled', 'confirmed');
CREATE TYPE public.property_type AS ENUM ('hotel', 'motel', 'hostel', 'apartment', 'house', 'cabin', 'resort', 'bnb');

-- Create profiles table for basic user info
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create user_roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'guest',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, role)
);

-- Create businesses table
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  country TEXT NOT NULL CHECK (country IN ('NZ', 'AU')),
  business_number TEXT, -- NZBN or ABN
  physical_address TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_role TEXT,
  business_email TEXT NOT NULL,
  business_phone TEXT,
  billing_email TEXT NOT NULL,
  billing_country TEXT,
  terms_accepted BOOLEAN DEFAULT FALSE NOT NULL,
  fee_acknowledged BOOLEAN DEFAULT FALSE NOT NULL,
  cancellation_policy_accepted BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create properties table (seeded with sample data)
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  property_type property_type NOT NULL DEFAULT 'hotel',
  country TEXT NOT NULL CHECK (country IN ('NZ', 'AU')),
  city TEXT NOT NULL,
  area TEXT,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  amenities TEXT[],
  registration_status TEXT DEFAULT 'registered',
  is_claimed BOOLEAN DEFAULT FALSE,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create rooms table
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  max_adults INTEGER NOT NULL DEFAULT 2,
  max_children INTEGER NOT NULL DEFAULT 0,
  bed_configuration TEXT,
  amenities TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create offers table
CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  status offer_status NOT NULL DEFAULT 'pending',
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  adults INTEGER NOT NULL DEFAULT 1,
  children INTEGER NOT NULL DEFAULT 0,
  offer_amount DECIMAL(10, 2) NOT NULL,
  counter_amount DECIMAL(10, 2),
  guest_notes TEXT,
  accessibility_needs TEXT,
  amenities_required TEXT[],
  payment_confirmed BOOLEAN DEFAULT FALSE,
  response_token UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create conversations table
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID REFERENCES public.offers(id) ON DELETE CASCADE NOT NULL UNIQUE,
  guest_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_unlocked BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create billable_events table
CREATE TABLE public.billable_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 8.99,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  invoice_number TEXT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  gst_amount DECIMAL(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billable_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to handle new user signup (creates profile and assigns guest role)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'guest');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies for businesses
CREATE POLICY "Business owners can view own business"
  ON public.businesses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Business owners can update own business"
  ON public.businesses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create business"
  ON public.businesses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for properties (publicly viewable, business can manage)
CREATE POLICY "Anyone can view properties"
  ON public.properties FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Business can manage own properties"
  ON public.properties FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));

-- RLS Policies for rooms (publicly viewable)
CREATE POLICY "Anyone can view rooms"
  ON public.rooms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Business can manage rooms for own properties"
  ON public.rooms FOR ALL
  USING (property_id IN (
    SELECT p.id FROM public.properties p
    JOIN public.businesses b ON p.business_id = b.id
    WHERE b.user_id = auth.uid()
  ));

-- RLS Policies for offers
CREATE POLICY "Guests can view own offers"
  ON public.offers FOR SELECT
  USING (auth.uid() = guest_user_id);

CREATE POLICY "Business can view offers for their properties"
  ON public.offers FOR SELECT
  USING (property_id IN (
    SELECT p.id FROM public.properties p
    JOIN public.businesses b ON p.business_id = b.id
    WHERE b.user_id = auth.uid()
  ));

CREATE POLICY "Guests can create offers"
  ON public.offers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = guest_user_id);

CREATE POLICY "Guests can update own pending offers"
  ON public.offers FOR UPDATE
  USING (auth.uid() = guest_user_id AND status = 'pending');

CREATE POLICY "Business can update offers for their properties"
  ON public.offers FOR UPDATE
  USING (property_id IN (
    SELECT p.id FROM public.properties p
    JOIN public.businesses b ON p.business_id = b.id
    WHERE b.user_id = auth.uid()
  ));

-- RLS Policies for conversations
CREATE POLICY "Participants can view conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = guest_user_id OR auth.uid() = business_user_id);

CREATE POLICY "System can create conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = guest_user_id);

-- RLS Policies for messages (only if conversation unlocked)
CREATE POLICY "Participants can view messages"
  ON public.messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE (guest_user_id = auth.uid() OR business_user_id = auth.uid())
        AND is_unlocked = true
    )
  );

CREATE POLICY "Participants can send messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE (guest_user_id = auth.uid() OR business_user_id = auth.uid())
        AND is_unlocked = true
    )
    AND auth.uid() = sender_user_id
  );

-- RLS Policies for billable_events
CREATE POLICY "Business can view own billable events"
  ON public.billable_events FOR SELECT
  USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));

-- RLS Policies for invoices
CREATE POLICY "Business can view own invoices"
  ON public.invoices FOR SELECT
  USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_offers_updated_at
  BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 20251220104237_792ef1ba-b20f-45ad-b44c-784cbcb15084.sql ----------
-- Fix function search_path security warning
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ---------- 20251221031226_dd953711-e993-472f-b5f8-d73d8589bb21.sql ----------
-- Add payment collection method to businesses
ALTER TABLE public.businesses 
ADD COLUMN payment_collection_method text NOT NULL DEFAULT 'pay_at_property'
CHECK (payment_collection_method IN ('pay_at_property', 'pay_upfront'));

-- Add BCF payment tracking columns to offers
ALTER TABLE public.offers 
ADD COLUMN bcf_payment_status text DEFAULT 'pending' CHECK (bcf_payment_status IN ('pending', 'paid', 'failed')),
ADD COLUMN bcf_stripe_payment_id text,
ADD COLUMN bcf_paid_at timestamp with time zone,
ADD COLUMN bcf_amount numeric,
ADD COLUMN bcf_currency text;

-- ---------- 20251221060337_69f2bdec-82f3-43bc-8ff0-c72b3ee837d9.sql ----------
-- Add 'submitted' and 'cancelled' to the offer_status enum
ALTER TYPE offer_status ADD VALUE IF NOT EXISTS 'submitted';
ALTER TYPE offer_status ADD VALUE IF NOT EXISTS 'cancelled';

-- ---------- 20251221060403_486ff59a-d2c7-4764-a05d-b888bb75faf9.sql ----------
-- Change the default status for new offers to 'submitted'
ALTER TABLE offers ALTER COLUMN status SET DEFAULT 'submitted'::offer_status;

-- Add response_token_expires_at column with 14-day default
ALTER TABLE offers 
ADD COLUMN IF NOT EXISTS response_token_expires_at timestamptz 
DEFAULT (now() + interval '14 days');

-- Add unique constraint on response_token
ALTER TABLE offers 
ADD CONSTRAINT offers_response_token_unique UNIQUE (response_token);

-- ---------- 20251221063338_9ce8f2d7-3a3a-4293-a77f-676bd7b1947e.sql ----------
-- Create a function to fetch offer by token (bypasses RLS for token-based access)
CREATE OR REPLACE FUNCTION public.get_offer_by_token(
  _offer_id uuid,
  _token uuid
)
RETURNS TABLE (
  id uuid,
  status text,
  offer_amount numeric,
  counter_amount numeric,
  adults integer,
  children integer,
  check_in_date date,
  check_out_date date,
  guest_notes text,
  response_token uuid,
  response_token_expires_at timestamptz,
  guest_user_id uuid,
  property_id uuid,
  room_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    o.id,
    o.status::text,
    o.offer_amount,
    o.counter_amount,
    o.adults,
    o.children,
    o.check_in_date,
    o.check_out_date,
    o.guest_notes,
    o.response_token,
    o.response_token_expires_at,
    o.guest_user_id,
    o.property_id,
    o.room_id
  FROM public.offers o
  WHERE o.id = _offer_id
    AND o.response_token = _token
    AND (o.response_token_expires_at IS NULL OR o.response_token_expires_at > now())
$$;

-- ---------- 20251221071021_01ec6acd-34bb-424e-b4df-0cb06f876adb.sql ----------
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

-- ---------- 20251221071926_c6529d24-a096-4895-a1d9-bbdd746927ad.sql ----------
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

-- ---------- 20251221083200_34e2c5db-0a03-495a-bb2c-b03effd08b48.sql ----------
-- Seed demo properties across NZ and AU
INSERT INTO public.properties (id, name, city, country, area, address, latitude, longitude, property_type, description, amenities, is_claimed, registration_status)
VALUES
  -- New Zealand
  ('11111111-1111-1111-1111-111111111101', 'The Wellington Grand', 'Wellington', 'NZ', 'CBD', '123 Lambton Quay, Wellington 6011', -41.2865, 174.7762, 'hotel', 'Luxury boutique hotel in the heart of Wellington with stunning harbour views.', ARRAY['wifi', 'breakfast', 'gym', 'restaurant', 'bar', 'room_service'], true, 'registered'),
  ('11111111-1111-1111-1111-111111111102', 'Auckland Harbourside Inn', 'Auckland', 'NZ', 'Viaduct', '45 Princes Wharf, Auckland 1010', -36.8419, 174.7650, 'hotel', 'Modern waterfront hotel with easy access to Auckland attractions.', ARRAY['wifi', 'pool', 'gym', 'parking', 'restaurant'], true, 'registered'),
  ('11111111-1111-1111-1111-111111111103', 'Queenstown Alpine Lodge', 'Queenstown', 'NZ', 'CBD', '78 Beach Street, Queenstown 9300', -45.0312, 168.6626, 'bnb', 'Cozy alpine retreat with mountain views and ski access.', ARRAY['wifi', 'fireplace', 'kitchen', 'parking', 'ski_storage'], true, 'registered'),
  ('11111111-1111-1111-1111-111111111104', 'Rotorua Thermal Escape', 'Rotorua', 'NZ', 'Lakefront', '22 Lake Road, Rotorua 3010', -38.1368, 176.2497, 'resort', 'Relaxing resort with natural hot pools and spa treatments.', ARRAY['wifi', 'spa', 'pool', 'restaurant', 'hot_tub'], true, 'registered'),
  ('11111111-1111-1111-1111-111111111105', 'Christchurch City Suites', 'Christchurch', 'NZ', 'CBD', '156 Victoria Street, Christchurch 8013', -43.5321, 172.6362, 'apartment', 'Modern apartments in the rebuilt Christchurch city center.', ARRAY['wifi', 'kitchen', 'laundry', 'parking', 'gym'], true, 'registered'),
  ('11111111-1111-1111-1111-111111111106', 'Taupo Lakefront Motel', 'Taupo', 'NZ', 'Lakefront', '88 Lake Terrace, Taupo 3330', -38.6857, 176.0702, 'motel', 'Family-friendly motel with direct lake access and BBQ areas.', ARRAY['wifi', 'kitchen', 'bbq', 'parking', 'playground'], true, 'registered'),
  -- Australia
  ('11111111-1111-1111-1111-111111111107', 'Sydney Harbour Hotel', 'Sydney', 'AU', 'The Rocks', '99 George Street, The Rocks NSW 2000', -33.8568, 151.2093, 'hotel', 'Iconic hotel with Opera House and Harbour Bridge views.', ARRAY['wifi', 'pool', 'gym', 'restaurant', 'bar', 'spa'], true, 'registered'),
  ('11111111-1111-1111-1111-111111111108', 'Melbourne Lanes Boutique', 'Melbourne', 'AU', 'CBD', '234 Flinders Lane, Melbourne VIC 3000', -37.8136, 144.9631, 'bnb', 'Boutique accommodation in Melbourne iconic laneway district.', ARRAY['wifi', 'breakfast', 'coffee', 'rooftop'], true, 'registered'),
  ('11111111-1111-1111-1111-111111111109', 'Brisbane River Apartments', 'Brisbane', 'AU', 'South Bank', '56 Grey Street, South Brisbane QLD 4101', -27.4698, 153.0251, 'apartment', 'Riverside apartments near cultural precinct and restaurants.', ARRAY['wifi', 'pool', 'gym', 'kitchen', 'balcony'], true, 'registered'),
  ('11111111-1111-1111-1111-111111111110', 'Gold Coast Beachfront Resort', 'Gold Coast', 'AU', 'Surfers Paradise', '100 The Esplanade, Surfers Paradise QLD 4217', -28.0027, 153.4310, 'resort', 'Beachfront resort with surf lessons and beach access.', ARRAY['wifi', 'pool', 'beach_access', 'restaurant', 'bar', 'kids_club'], true, 'registered'),
  ('11111111-1111-1111-1111-111111111111', 'Perth City Hostel', 'Perth', 'AU', 'Northbridge', '189 William Street, Perth WA 6000', -31.9505, 115.8605, 'hostel', 'Budget-friendly hostel with rooftop bar and social events.', ARRAY['wifi', 'kitchen', 'laundry', 'rooftop_bar', 'lockers'], true, 'registered'),
  ('11111111-1111-1111-1111-111111111112', 'Cairns Tropical Retreat', 'Cairns', 'AU', 'CBD', '67 Abbott Street, Cairns QLD 4870', -16.9186, 145.7781, 'hotel', 'Gateway to the Great Barrier Reef with tropical gardens.', ARRAY['wifi', 'pool', 'restaurant', 'tour_desk', 'dive_shop'], true, 'registered')
ON CONFLICT (id) DO NOTHING;

-- Seed rooms for each property
INSERT INTO public.rooms (id, property_id, name, description, max_adults, max_children, bed_configuration, amenities)
VALUES
  -- Wellington Grand rooms
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'Harbour View Studio', 'Compact studio with harbour views', 2, 0, 'Queen bed', ARRAY['wifi', 'tv', 'minibar', 'safe']),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', 'Deluxe King Suite', 'Spacious suite with separate living area', 2, 2, 'King bed', ARRAY['wifi', 'tv', 'minibar', 'safe', 'bathtub']),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111101', 'Twin Room', 'Classic twin room for friends or colleagues', 2, 0, '2 Single beds', ARRAY['wifi', 'tv', 'desk']),
  ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111101', 'Family Suite', 'Large suite perfect for families', 2, 3, 'King + 2 Singles', ARRAY['wifi', 'tv', 'kitchenette', 'washer']),
  -- Auckland Harbourside rooms
  ('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111102', 'Standard Queen', 'Comfortable queen room with city views', 2, 1, 'Queen bed', ARRAY['wifi', 'tv', 'coffee']),
  ('22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111102', 'Premium King', 'Premium room with harbour glimpses', 2, 1, 'King bed', ARRAY['wifi', 'tv', 'minibar', 'balcony']),
  ('22222222-2222-2222-2222-222222222207', '11111111-1111-1111-1111-111111111102', 'Executive Suite', 'Top floor suite with panoramic views', 2, 2, 'King bed + Sofa', ARRAY['wifi', 'tv', 'minibar', 'lounge', 'bathtub']),
  -- Queenstown Alpine rooms
  ('22222222-2222-2222-2222-222222222208', '11111111-1111-1111-1111-111111111103', 'Cozy Studio', 'Warm studio with mountain views', 2, 0, 'Queen bed', ARRAY['wifi', 'heating', 'kitchenette']),
  ('22222222-2222-2222-2222-222222222209', '11111111-1111-1111-1111-111111111103', 'Alpine Queen', 'Romantic room with fireplace', 2, 0, 'Queen bed', ARRAY['wifi', 'fireplace', 'bathtub']),
  ('22222222-2222-2222-2222-222222222210', '11111111-1111-1111-1111-111111111103', 'Family Chalet', 'Spacious chalet for families', 2, 3, 'King + Bunk beds', ARRAY['wifi', 'kitchen', 'fireplace', 'ski_storage']),
  -- Rotorua Thermal rooms
  ('22222222-2222-2222-2222-222222222211', '11111111-1111-1111-1111-111111111104', 'Garden View Room', 'Peaceful room overlooking gardens', 2, 1, 'Queen bed', ARRAY['wifi', 'tv', 'hot_tub_access']),
  ('22222222-2222-2222-2222-222222222212', '11111111-1111-1111-1111-111111111104', 'Thermal Suite', 'Suite with private hot tub', 2, 0, 'King bed', ARRAY['wifi', 'tv', 'private_hot_tub', 'balcony']),
  ('22222222-2222-2222-2222-222222222213', '11111111-1111-1111-1111-111111111104', 'Lakefront Villa', 'Luxury villa with lake views', 4, 2, '2 King beds', ARRAY['wifi', 'kitchen', 'private_pool', 'bbq']),
  -- Christchurch Suites rooms
  ('22222222-2222-2222-2222-222222222214', '11111111-1111-1111-1111-111111111105', '1BR Apartment', 'Modern one bedroom apartment', 2, 1, 'Queen bed', ARRAY['wifi', 'kitchen', 'laundry', 'parking']),
  ('22222222-2222-2222-2222-222222222215', '11111111-1111-1111-1111-111111111105', '2BR Apartment', 'Spacious two bedroom apartment', 4, 2, 'King + Twin', ARRAY['wifi', 'kitchen', 'laundry', 'parking', 'balcony']),
  ('22222222-2222-2222-2222-222222222216', '11111111-1111-1111-1111-111111111105', 'Studio Apartment', 'Compact studio for solo travelers', 2, 0, 'Double bed', ARRAY['wifi', 'kitchenette']),
  -- Taupo Motel rooms
  ('22222222-2222-2222-2222-222222222217', '11111111-1111-1111-1111-111111111106', 'Lake View Unit', 'Unit with stunning lake views', 2, 2, 'Queen + Single', ARRAY['wifi', 'kitchen', 'bbq']),
  ('22222222-2222-2222-2222-222222222218', '11111111-1111-1111-1111-111111111106', 'Family Unit', 'Large unit for families', 2, 4, 'Queen + 2 Bunks', ARRAY['wifi', 'kitchen', 'bbq', 'playground_access']),
  ('22222222-2222-2222-2222-222222222219', '11111111-1111-1111-1111-111111111106', 'Budget Double', 'Affordable double room', 2, 0, 'Double bed', ARRAY['wifi', 'tv']),
  -- Sydney Harbour rooms
  ('22222222-2222-2222-2222-222222222220', '11111111-1111-1111-1111-111111111107', 'Opera View Room', 'Room with Opera House views', 2, 0, 'King bed', ARRAY['wifi', 'tv', 'minibar', 'balcony']),
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111107', 'Bridge View Suite', 'Suite facing Harbour Bridge', 2, 2, 'King + Sofa', ARRAY['wifi', 'tv', 'minibar', 'lounge', 'bathtub']),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111107', 'Standard Twin', 'Comfortable twin room', 2, 0, '2 Single beds', ARRAY['wifi', 'tv', 'coffee']),
  ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111107', 'Penthouse Suite', 'Luxury penthouse with 360 views', 4, 2, '2 King beds', ARRAY['wifi', 'tv', 'minibar', 'lounge', 'private_terrace', 'butler']),
  -- Melbourne Lanes rooms
  ('22222222-2222-2222-2222-222222222224', '11111111-1111-1111-1111-111111111108', 'Laneway Room', 'Cozy room with laneway views', 2, 0, 'Queen bed', ARRAY['wifi', 'coffee', 'breakfast']),
  ('22222222-2222-2222-2222-222222222225', '11111111-1111-1111-1111-111111111108', 'Rooftop Loft', 'Loft with rooftop access', 2, 0, 'King bed', ARRAY['wifi', 'coffee', 'breakfast', 'rooftop_access']),
  ('22222222-2222-2222-2222-222222222226', '11111111-1111-1111-1111-111111111108', 'Artist Suite', 'Artistically decorated suite', 2, 1, 'Queen + Sofa', ARRAY['wifi', 'coffee', 'breakfast', 'art_supplies']),
  -- Brisbane River rooms
  ('22222222-2222-2222-2222-222222222227', '11111111-1111-1111-1111-111111111109', '1BR River View', 'One bedroom with river views', 2, 1, 'Queen bed', ARRAY['wifi', 'kitchen', 'balcony', 'pool_access']),
  ('22222222-2222-2222-2222-222222222228', '11111111-1111-1111-1111-111111111109', '2BR Penthouse', 'Two bedroom penthouse apartment', 4, 2, '2 Queen beds', ARRAY['wifi', 'kitchen', 'balcony', 'pool_access', 'gym_access']),
  ('22222222-2222-2222-2222-222222222229', '11111111-1111-1111-1111-111111111109', 'Studio', 'Compact riverside studio', 2, 0, 'Double bed', ARRAY['wifi', 'kitchenette', 'pool_access']),
  -- Gold Coast Resort rooms
  ('22222222-2222-2222-2222-222222222230', '11111111-1111-1111-1111-111111111110', 'Ocean View Room', 'Room with stunning ocean views', 2, 1, 'King bed', ARRAY['wifi', 'tv', 'beach_access']),
  ('22222222-2222-2222-2222-222222222231', '11111111-1111-1111-1111-111111111110', 'Beach Suite', 'Suite with direct beach access', 2, 2, 'King + Sofa', ARRAY['wifi', 'tv', 'beach_access', 'balcony']),
  ('22222222-2222-2222-2222-222222222232', '11111111-1111-1111-1111-111111111110', 'Family Cabana', 'Beachfront cabana for families', 4, 4, '2 Queen + Bunks', ARRAY['wifi', 'kitchen', 'beach_access', 'bbq', 'kids_pool']),
  ('22222222-2222-2222-2222-222222222233', '11111111-1111-1111-1111-111111111110', 'Surf Studio', 'Budget room for surfers', 2, 0, 'Double bed', ARRAY['wifi', 'surfboard_storage']),
  -- Perth Hostel rooms
  ('22222222-2222-2222-2222-222222222234', '11111111-1111-1111-1111-111111111111', 'Private Double', 'Private room with double bed', 2, 0, 'Double bed', ARRAY['wifi', 'locker']),
  ('22222222-2222-2222-2222-222222222235', '11111111-1111-1111-1111-111111111111', 'Private Twin', 'Private room with twin beds', 2, 0, '2 Single beds', ARRAY['wifi', 'locker']),
  ('22222222-2222-2222-2222-222222222236', '11111111-1111-1111-1111-111111111111', '4-Bed Dorm', 'Shared dorm with 4 beds', 4, 0, '4 Bunk beds', ARRAY['wifi', 'locker', 'reading_light']),
  -- Cairns Tropical rooms
  ('22222222-2222-2222-2222-222222222237', '11111111-1111-1111-1111-111111111112', 'Garden Room', 'Room overlooking tropical gardens', 2, 1, 'Queen bed', ARRAY['wifi', 'tv', 'pool_access']),
  ('22222222-2222-2222-2222-222222222238', '11111111-1111-1111-1111-111111111112', 'Reef Suite', 'Suite with reef tour packages', 2, 2, 'King + Sofa', ARRAY['wifi', 'tv', 'pool_access', 'reef_tour_desk']),
  ('22222222-2222-2222-2222-222222222239', '11111111-1111-1111-1111-111111111112', 'Tropical Villa', 'Private villa with plunge pool', 4, 2, '2 King beds', ARRAY['wifi', 'kitchen', 'private_pool', 'bbq'])
ON CONFLICT (id) DO NOTHING;

-- ---------- 20251222035645_ab8e899c-7a05-4bb8-ac37-1e7c2e1233e7.sql ----------
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

-- ---------- 20251223024704_c0dd795a-e69a-4f52-87e4-725a655e6f0f.sql ----------
-- Add address fields to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS address_line1 text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS region text,
ADD COLUMN IF NOT EXISTS postcode text,
ADD COLUMN IF NOT EXISTS lat numeric,
ADD COLUMN IF NOT EXISTS lng numeric;

-- ---------- 20251223040405_c7f99938-be21-4c99-a590-03c43b5333df.sql ----------
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

-- ---------- 20251223083813_f165794e-026f-4e18-81f3-ac2f6aad9b66.sql ----------
-- Add tax registration fields to businesses table
ALTER TABLE public.businesses 
ADD COLUMN tax_identifier text NULL,
ADD COLUMN nzbn text NULL;

-- Add comments for clarity
COMMENT ON COLUMN public.businesses.tax_identifier IS 'GST number (NZ) or ABN (AU) for tax-compliant invoicing';
COMMENT ON COLUMN public.businesses.nzbn IS 'New Zealand Business Number (NZBN) - optional';

-- ---------- 20251223084826_5557159f-e35b-435a-9724-1d01b7cbfc07.sql ----------
-- Add fee settlement fields to offers table for invoice-ready data model
ALTER TABLE public.offers 
ADD COLUMN fee_amount numeric NULL,
ADD COLUMN fee_currency text NULL DEFAULT 'NZD',
ADD COLUMN fee_settled_via text NULL CHECK (fee_settled_via IN ('guest_admin_fee', 'business_invoice')),
ADD COLUMN fee_payment_status text NULL DEFAULT 'pending' CHECK (fee_payment_status IN ('pending', 'paid', 'unpaid', 'void')),
ADD COLUMN confirmed_at timestamp with time zone NULL,
ADD COLUMN invoice_id uuid NULL;

-- Add comments for clarity
COMMENT ON COLUMN public.offers.fee_amount IS 'Booking confirmation fee amount (NZD 8.99 or AUD 12.00)';
COMMENT ON COLUMN public.offers.fee_currency IS 'Currency for fee (NZD or AUD)';
COMMENT ON COLUMN public.offers.fee_settled_via IS 'How the fee is settled: guest_admin_fee (guest pays on acceptance) or business_invoice (monthly invoice to business)';
COMMENT ON COLUMN public.offers.fee_payment_status IS 'Payment status of the fee: pending, paid, unpaid, or void';
COMMENT ON COLUMN public.offers.confirmed_at IS 'Timestamp when the offer was confirmed';
COMMENT ON COLUMN public.offers.invoice_id IS 'Reference to the invoice if fee is settled via business_invoice';

-- ---------- 20251223094814_a2c38a5e-e10a-4921-8155-334bbc657548.sql ----------
-- 1) Admin allowlist table (avoid enum changes)
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Only admins can view admin list
CREATE POLICY "Admins can view admin users"
ON public.admin_users
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
);

-- 2) Helper function for RLS checks
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
  );
$$;

-- 3) Invoice line items table
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id),
  offer_id uuid NOT NULL REFERENCES public.offers(id),
  booking_confirmed_at timestamptz NOT NULL,
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  admin_fee_amount numeric NOT NULL,
  description text NOT NULL DEFAULT 'Booking Confirmation Fee',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invoice_id, offer_id)
);

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Business can view their own line items via their invoices
CREATE POLICY "Businesses can view own invoice line items"
ON public.invoice_line_items
FOR SELECT
USING (
  invoice_id IN (
    SELECT i.id
    FROM public.invoices i
    WHERE i.business_id IN (
      SELECT b.id FROM public.businesses b WHERE b.user_id = auth.uid()
    )
  )
);

-- Admin can view all line items
CREATE POLICY "Admins can view all invoice line items"
ON public.invoice_line_items
FOR SELECT
USING (public.is_admin());

-- 4) Add admin policy to existing invoices table
CREATE POLICY "Admins can view all invoices"
ON public.invoices
FOR SELECT
USING (public.is_admin());

-- 5) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_invoices_business_id ON public.invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON public.invoices(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON public.invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_offer_id ON public.invoice_line_items(offer_id);

-- ---------- 20251223105508_cac536ff-a74e-4004-a9fb-ab93e160e2ce.sql ----------
-- Add required columns to billable_events for invoice tracking
ALTER TABLE public.billable_events
ADD COLUMN IF NOT EXISTS property_id uuid,
ADD COLUMN IF NOT EXISTS booking_confirmed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS check_in_date date,
ADD COLUMN IF NOT EXISTS check_out_date date,
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'NZD',
ADD COLUMN IF NOT EXISTS billing_model text,
ADD COLUMN IF NOT EXISTS invoiced_invoice_id uuid;

-- Rename amount to admin_fee_amount for clarity (if it doesn't break existing queries)
-- Actually, let's add admin_fee_amount as new column and keep amount for compatibility
ALTER TABLE public.billable_events
ADD COLUMN IF NOT EXISTS admin_fee_amount numeric;

-- Add foreign key constraints
ALTER TABLE public.billable_events
ADD CONSTRAINT fk_billable_events_property FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_billable_events_invoice FOREIGN KEY (invoiced_invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

-- Add index for efficient invoice generation queries
CREATE INDEX IF NOT EXISTS idx_billable_events_uninvoiced 
ON public.billable_events(business_id, invoiced_invoice_id) 
WHERE invoiced_invoice_id IS NULL;

-- ---------- 20251223111323_b13d9400-4356-4498-af7b-868cb7823e68.sql ----------
-- Allow admins to update invoices (for marking as paid/void)
CREATE POLICY "Admins can update invoices"
ON public.invoices
FOR UPDATE
USING (is_admin())
WITH CHECK (is_admin());

-- ---------- 20260201090000_offer_ai_availability.sql ----------
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


-- ---------- 20260203233000_add_admin_user.sql ----------
-- Add admin user by email
insert into public.admin_users (user_id)
select id from auth.users where email = 'askteamonline@gmail.com'
on conflict do nothing;


-- ============================================================
-- Added for a standalone project (not in original migrations):
-- Enable realtime so live chat + unread notifications work
-- ============================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.offers;

-- Make YOUR account an admin (run AFTER you've signed up once in the app)
insert into public.admin_users (user_id)
select id from auth.users where email = 'falconercarlandrew@gmail.com'
on conflict do nothing;
