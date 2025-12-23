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