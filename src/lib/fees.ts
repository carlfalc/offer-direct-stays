// findastay commitment fee — tiered by booking total (Carl, 2026-10-26).
// The traveller pays this; it comes out of the booking total, so the property
// nets (total − fee). findastay never takes a commission.
//   under $500  → $9.99
//   $500–$1,000 → $14.99
//   over $1,000 → $24.99
export function commitmentFee(total: number): number {
  const t = total || 0;
  if (t > 1000) return 24.99;
  if (t >= 500) return 14.99;
  return 9.99;
}

/** What the property collects directly = agreed total − commitment fee. */
export function balancePayable(total: number): number {
  return Math.max(0, (total || 0) - commitmentFee(total));
}

export const FEE_BANDS_LABEL = 'Under $500: $9.99 · $500–$1,000: $14.99 · Over $1,000: $24.99';
