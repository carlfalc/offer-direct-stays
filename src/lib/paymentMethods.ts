// How a property can accept the stay payment. findastay never processes these —
// it only takes the commitment fee. Editable by the owner at any time.
export const PAYMENT_METHODS = [
  { id: 'bank_transfer', label: 'Bank transfer / deposit', hint: 'Guest pays into your bank account (you share details in the chat).' },
  { id: 'pay_on_arrival', label: 'Pay on arrival', hint: 'Guest pays at your property — your EFTPOS/terminal or cash.' },
  { id: 'card_property', label: 'Card — you take it', hint: 'You contact the guest and take their card on your own terminal/phone.' },
  { id: 'payment_link', label: 'Your own payment link', hint: 'Paste your secure payment page (Stripe/Windcave) — the card stays on your page.' },
] as const;

export type PaymentMethodId = typeof PAYMENT_METHODS[number]['id'];

export const paymentMethodLabel = (id: string): string =>
  PAYMENT_METHODS.find((m) => m.id === id)?.label || id;
