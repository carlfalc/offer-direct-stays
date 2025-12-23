-- Allow admins to update invoices (for marking as paid/void)
CREATE POLICY "Admins can update invoices"
ON public.invoices
FOR UPDATE
USING (is_admin())
WITH CHECK (is_admin());