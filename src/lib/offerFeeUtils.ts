import { BOOKING_FEES } from '@/types/invoice';

/**
 * Get fee details based on country and payment method
 */
export function getOfferFeeDetails(
  country: string,
  paymentCollectionMethod: string
): {
  feeAmount: number;
  feeCurrency: 'NZD' | 'AUD';
  feeSettledVia: 'guest_admin_fee' | 'business_invoice';
} {
  const feeCurrency = country === 'AU' ? 'AUD' : 'NZD';
  const feeAmount = BOOKING_FEES[feeCurrency];
  
  // Map payment collection method to fee settlement method
  const feeSettledVia = paymentCollectionMethod === 'business_invoice' 
    ? 'business_invoice' 
    : 'guest_admin_fee';
  
  return {
    feeAmount,
    feeCurrency,
    feeSettledVia,
  };
}

/**
 * Build the update payload for confirming an offer with fee fields
 */
export function buildOfferConfirmPayload(
  country: string,
  paymentCollectionMethod: string
): {
  status: 'confirmed';
  fee_amount: number;
  fee_currency: string;
  fee_settled_via: string;
  fee_payment_status: string;
  confirmed_at: string;
} {
  const { feeAmount, feeCurrency, feeSettledVia } = getOfferFeeDetails(country, paymentCollectionMethod);
  
  return {
    status: 'confirmed',
    fee_amount: feeAmount,
    fee_currency: feeCurrency,
    fee_settled_via: feeSettledVia,
    fee_payment_status: feeSettledVia === 'guest_admin_fee' ? 'paid' : 'unpaid',
    confirmed_at: new Date().toISOString(),
  };
}
