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