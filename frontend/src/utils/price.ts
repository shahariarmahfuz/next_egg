/**
 * Price, quantity, and decimal arithmetic utilities.
 *
 * Ensures precise decimal operations without floating-point artifacts
 * (e.g. 5 * 2.32 = 11.600000000000001) while preserving valid decimals.
 */

/**
 * Rounds/cleans a number to a specific precision using exponential notation
 * to avoid standard IEEE-754 binary floating-point errors.
 * Trailing zeros are naturally stripped by Number/parseFloat.
 */
export function roundToPrecision(amount: number, maxDecimals: number = 4): number {
  if (!Number.isFinite(amount)) return 0;
  return Number(Math.round(Number(`${amount}e${maxDecimals}`)) + `e-${maxDecimals}`);
}

/**
 * Calculates line total: (quantity * unit_price) - discount
 * Preserves decimal values cleanly.
 */
export function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  discount: number = 0
): number {
  const total = quantity * unitPrice - discount;
  return total > 0 ? roundToPrecision(total, 4) : 0;
}

/**
 * Recalculates unit price from total price: (total_price + discount) / quantity
 * Preserves decimal values cleanly without float noise.
 */
export function calculateUnitPrice(
  totalPrice: number,
  quantity: number,
  discount: number = 0
): number {
  if (quantity <= 0) return 0;
  const price = (totalPrice + discount) / quantity;
  return price > 0 ? roundToPrecision(price, 4) : 0;
}
