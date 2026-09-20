import Decimal from "decimal.js";

// Configure precision and rounding for decimal operations
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Price, quantity, and decimal arithmetic utilities.
 *
 * Ensures precise decimal operations without floating-point artifacts
 * (e.g. 5 * 2.32 = 11.600000000000001) while preserving exact financials.
 */

/**
 * Rounds/cleans a number or string to a specific decimal precision using Decimal.
 */
export function roundToPrecision(amount: number | string, maxDecimals: number = 4): number {
  if (amount === "" || amount === null || amount === undefined) return 0;
  try {
    const dec = new Decimal(amount);
    if (!dec.isFinite()) return 0;
    return dec.toDecimalPlaces(maxDecimals, Decimal.ROUND_HALF_UP).toNumber();
  } catch {
    return 0;
  }
}

/**
 * Calculates line total: (quantity * unit_price) - discount
 * Used when in unit_price pricing mode (Mode A).
 */
export function calculateLineTotal(
  quantity: number | string,
  unitPrice: number | string,
  discount: number | string = 0
): number {
  try {
    const q = new Decimal(quantity || 0);
    const p = new Decimal(unitPrice || 0);
    const d = new Decimal(discount || 0);
    const total = q.times(p).minus(d);
    return total.greaterThan(0) ? total.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber() : 0;
  } catch {
    return 0;
  }
}

/**
 * Recalculates unit price from total price: (total_price + discount) / quantity
 * Used when in total_price pricing mode (Mode B) to display derived unit price.
 */
export function calculateUnitPrice(
  totalPrice: number | string,
  quantity: number | string,
  discount: number | string = 0
): number {
  try {
    const q = new Decimal(quantity || 0);
    if (q.lessThanOrEqualTo(0)) return 0;
    const t = new Decimal(totalPrice || 0);
    const d = new Decimal(discount || 0);
    const price = t.plus(d).dividedBy(q);
    return price.greaterThan(0) ? price.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber() : 0;
  } catch {
    return 0;
  }
}

/**
 * Calculates invoice subtotal from array of items.
 */
export function calculateSubtotal(items: Array<{ total_price: number | string }>): number {
  try {
    const sum = items.reduce((acc, item) => {
      return acc.plus(new Decimal(item.total_price || 0));
    }, new Decimal(0));
    return sum.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
  } catch {
    return 0;
  }
}

/**
 * Calculates grand total: subtotal - discount + tax
 */
export function calculateGrandTotal(
  subtotal: number | string,
  discountAmount: number | string = 0,
  taxAmount: number | string = 0
): number {
  try {
    const sub = new Decimal(subtotal || 0);
    const disc = new Decimal(discountAmount || 0);
    const tax = new Decimal(taxAmount || 0);
    const total = sub.minus(disc).plus(tax);
    return total.greaterThan(0) ? total.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber() : 0;
  } catch {
    return 0;
  }
}

/**
 * Calculates due amount: grand_total - paid_amount
 */
export function calculateDueAmount(
  grandTotal: number | string,
  paidAmount: number | string = 0
): number {
  try {
    const gt = new Decimal(grandTotal || 0);
    const paid = new Decimal(paidAmount || 0);
    const due = gt.minus(paid);
    return due.greaterThan(0) ? due.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber() : 0;
  } catch {
    return 0;
  }
}
