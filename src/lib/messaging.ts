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
 * Composer guard. The only thing we never allow through the chat is a card
 * number (also enforced by a database trigger). Phone and email ARE allowed —
 * once a booking is confirmed the property needs the guest's contact details to
 * book them in, so there's nothing to hide at this stage.
 */
export function scanMessage(text: string): { ok: boolean; reason?: string } {
  const digitsOnly = text.replace(/[\s-]/g, '');
  if (/\d{13,19}/.test(digitsOnly)) {
    return { ok: false, reason: 'For your security, never send card numbers here. Pay the property by their listed method (bank transfer, on arrival, or their secure card link).' };
  }
  return { ok: true };
}

/** A thread locks 10 days after checkout. */
export function threadLocked(checkOut: string): boolean {
  const lock = new Date(checkOut);
  lock.setDate(lock.getDate() + 10);
  return Date.now() > lock.getTime();
}
