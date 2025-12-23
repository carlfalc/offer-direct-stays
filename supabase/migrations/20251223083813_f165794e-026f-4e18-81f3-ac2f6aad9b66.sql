-- Add tax registration fields to businesses table
ALTER TABLE public.businesses 
ADD COLUMN tax_identifier text NULL,
ADD COLUMN nzbn text NULL;

-- Add comments for clarity
COMMENT ON COLUMN public.businesses.tax_identifier IS 'GST number (NZ) or ABN (AU) for tax-compliant invoicing';
COMMENT ON COLUMN public.businesses.nzbn IS 'New Zealand Business Number (NZBN) - optional';