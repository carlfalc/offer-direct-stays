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