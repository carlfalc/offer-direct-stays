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