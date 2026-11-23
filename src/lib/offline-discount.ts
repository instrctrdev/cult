/** Calculate one cashier discount in integer paise. Both modes cannot be combined. */
export function offlineDiscountPaise(subtotal: number, percent: number, fixedPaise: number) {
  if (!Number.isSafeInteger(subtotal) || subtotal < 0 || !Number.isFinite(percent) || percent < 0 || percent > 100 ||
    !Number.isSafeInteger(fixedPaise) || fixedPaise < 0 || (percent > 0 && fixedPaise > 0)) {
    throw new RangeError('Choose a valid fixed amount or percentage discount.');
  }
  if (fixedPaise > subtotal) throw new RangeError('Discount cannot exceed the sale subtotal.');
  return fixedPaise || Math.round(subtotal * percent / 100);
}
