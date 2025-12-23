// Invoice types for FindAStay booking confirmation fees

export interface InvoiceLineItem {
  id: string;
  confirmed_at: string;
  property_name: string;
  property_city: string;
  offer_reference: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_amount: number;
  line_total: number;
}

export interface InvoiceSupplier {
  name: string;
  address: string;
  email: string;
  tax_id: string | null;
  logo_url: string | null;
}

export interface InvoiceCustomer {
  business_name: string;
  address: string;
  billing_email: string;
  country: string;
  nzbn: string | null;
  tax_identifier: string | null; // GST (NZ) or ABN (AU)
}

export interface Invoice {
  id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  issued_at: string;
  currency: 'NZD' | 'AUD';
  
  supplier: InvoiceSupplier;
  customer: InvoiceCustomer;
  
  line_items: InvoiceLineItem[];
  
  subtotal: number;
  tax_total: number;
  total_due: number;
  
  status: 'draft' | 'pending' | 'paid' | 'void';
  paid_at: string | null;
  
  notes: string[];
}

// Fee amounts by currency
export const BOOKING_FEES = {
  NZD: 8.99,
  AUD: 12.00,
} as const;

// FindAStay supplier details (placeholder values)
export const FINDASTAY_SUPPLIER: InvoiceSupplier = {
  name: 'FindAStay Ltd',
  address: 'Auckland, New Zealand',
  email: 'billing@findastay.com',
  tax_id: null, // Placeholder - to be configured
  logo_url: null, // Will be set when logo is uploaded
};

export function generateInvoiceNumber(businessId: string, periodEnd: Date): string {
  const year = periodEnd.getFullYear();
  const month = String(periodEnd.getMonth() + 1).padStart(2, '0');
  const shortId = businessId.slice(0, 8).toUpperCase();
  return `INV-${year}${month}-${shortId}`;
}

export function getFeeByCurrency(country: string): { amount: number; currency: 'NZD' | 'AUD' } {
  const currency = country === 'AU' ? 'AUD' : 'NZD';
  return {
    amount: BOOKING_FEES[currency],
    currency,
  };
}
