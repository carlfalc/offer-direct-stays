// findastay messenger helpers — one thread per confirmed offer.

/** Commitment fee findastay takes (the only money we touch). */
export function commitmentFee(currency: string): number {
  return currency === 'AUD' ? 12 : 8.99;
}

/** Balance the property collects directly = agreed total − commitment fee. */
export function balancePayable(total: number, currency: string): number {
  return Math.max(0, total - commitmentFee(currency));
}

/**
 * Hard mask for the composer. Blocks anything that must not travel through our
 * chat: card numbers (also enforced server-side), and — to keep deals on
 * platform — email addresses and phone numbers.
 */
export function scanMessage(text: string): { ok: boolean; reason?: string } {
  const digitsOnly = text.replace(/[\s-]/g, '');
  if (/\d{13,19}/.test(digitsOnly)) {
    return { ok: false, reason: 'For your security, never send card numbers here. Pay the property by their listed method (bank transfer, on arrival, or their secure card link).' };
  }
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) {
    return { ok: false, reason: 'Keep contact details out of chat — email addresses can’t be sent. Everything you need is handled right here.' };
  }
  // phone: 8+ digits possibly spaced/dashed/with +country code
  if (/(?:\+?\d[\s-]?){8,}/.test(text)) {
    return { ok: false, reason: 'Keep contact details out of chat — phone numbers can’t be sent. Everything you need is handled right here.' };
  }
  return { ok: true };
}

/** A thread locks 10 days after checkout. */
export function threadLocked(checkOut: string): boolean {
  const lock = new Date(checkOut);
  lock.setDate(lock.getDate() + 10);
  return Date.now() > lock.getTime();
}
