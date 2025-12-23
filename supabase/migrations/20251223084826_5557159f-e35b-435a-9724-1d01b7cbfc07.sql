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