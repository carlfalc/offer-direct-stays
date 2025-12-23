import { 
  Invoice, 
  InvoiceLineItem, 
  InvoiceCustomer, 
  FINDASTAY_SUPPLIER, 
  BOOKING_FEES,
  generateInvoiceNumber,
  getFeeByCurrency 
} from '@/types/invoice';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface ConfirmedOffer {
  id: string;
  confirmed_at: string;
  property: {
    name: string;
    city: string;
  };
}

interface BusinessDetails {
  id: string;
  business_name: string;
  physical_address: string;
  billing_email: string;
  country: string;
  nzbn: string | null;
  tax_identifier: string | null;
}

/**
 * Generate an invoice for a business based on their confirmed bookings in a period
 */
export function generateMonthlyInvoice(
  business: BusinessDetails,
  confirmedOffers: ConfirmedOffer[],
  periodDate: Date = new Date()
): Invoice {
  const periodStart = startOfMonth(periodDate);
  const periodEnd = endOfMonth(periodDate);
  const issuedAt = new Date(); // 20th of following month typically
  
  const { amount: feeAmount, currency } = getFeeByCurrency(business.country);
  
  // Create line items from confirmed offers
  const lineItems: InvoiceLineItem[] = confirmedOffers.map((offer) => ({
    id: offer.id,
    confirmed_at: offer.confirmed_at,
    property_name: offer.property.name,
    property_city: offer.property.city,
    offer_reference: offer.id.slice(0, 8).toUpperCase(),
    description: 'Booking Confirmation Fee',
    quantity: 1,
    unit_price: feeAmount,
    tax_amount: 0, // 0% tax for now
    line_total: feeAmount,
  }));

  const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
  const taxTotal = 0; // 0% tax for now
  const totalDue = subtotal + taxTotal;

  const customer: InvoiceCustomer = {
    business_name: business.business_name,
    address: business.physical_address,
    billing_email: business.billing_email,
    country: business.country,
    nzbn: business.nzbn,
    tax_identifier: business.tax_identifier,
  };

  const invoice: Invoice = {
    id: crypto.randomUUID(),
    invoice_number: generateInvoiceNumber(business.id, periodEnd),
    period_start: format(periodStart, 'yyyy-MM-dd'),
    period_end: format(periodEnd, 'yyyy-MM-dd'),
    issued_at: format(issuedAt, 'yyyy-MM-dd'),
    currency,
    supplier: FINDASTAY_SUPPLIER,
    customer,
    line_items: lineItems,
    subtotal,
    tax_total: taxTotal,
    total_due: totalDue,
    status: 'pending',
    paid_at: null,
    notes: [
      'Fees apply only to confirmed bookings.',
      'This invoice does not include accommodation charges.',
    ],
  };

  return invoice;
}

/**
 * Get default invoice notes
 */
export function getInvoiceNotes(): string[] {
  return [
    'Fees apply only to confirmed bookings.',
    'This invoice does not include accommodation charges.',
  ];
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: 'NZD' | 'AUD'): string {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
