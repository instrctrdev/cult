import 'server-only';
import { PaymentMethod } from '@prisma/client';
import { apportion } from '@/lib/money';
import { getSettings } from '@/lib/settings';
import { CouponService, type CouponEvaluation, type CouponLineContext } from './coupon.service';
import { PaymentService } from './payment.service';
import type { PricingBreakdown } from '@/types';

export interface PriceableLine {
  productId: string;
  variantId: string;
  categoryIds: string[];
  /** Server-read variant price. Never a client-supplied value. */
  unitPricePaise: number;
  quantity: number;
}

export interface QuoteInput {
  lines: PriceableLine[];
  couponCode?: string | null;
  paymentMethod?: PaymentMethod;
  userId?: string | null;
}

export interface Quote {
  breakdown: PricingBreakdown;
  /** Discount allocated per line, index-aligned with `lines`. */
  lineDiscounts: number[];
  coupon: CouponEvaluation | null;
  couponError: string | null;
}

/**
 * The single source of truth for what an order costs.
 *
 * Both the cart display and the order-creation path call this with prices read
 * fresh from the database, so a tampered client payload cannot change a total.
 * Every rate comes from Admin → Settings, never from a constant here.
 */
export async function quote(input: QuoteInput): Promise<Quote> {
  const settings = await getSettings();

  const shipFee = settings['shipping.fee_paise'] as number;
  const freeEnabled = settings['shipping.free_enabled'] as boolean;
  const freeThreshold = settings['shipping.free_threshold_paise'] as number;
  const prepaidFree = settings['shipping.prepaid_free_enabled'] as boolean;
  const handlingPerItem = settings['handling.per_item_paise'] as number;
  const codFee = settings['shipping.cod_fee_paise'] as number;
  const taxEnabled = settings['tax.enabled'] as boolean;
  const taxRate = settings['tax.rate_percent'] as number;

  const lineSubtotals = input.lines.map((l) => l.unitPricePaise * l.quantity);
  const subtotal = lineSubtotals.reduce((a, b) => a + b, 0);
  const itemCount = input.lines.reduce((a, l) => a + l.quantity, 0);

  // ── Coupon ──────────────────────────────────────────────────────────────
  let coupon: CouponEvaluation | null = null;
  let couponError: string | null = null;

  if (input.couponCode && subtotal > 0) {
    const ctx: CouponLineContext[] = input.lines.map((l, i) => ({
      productId: l.productId,
      categoryIds: l.categoryIds,
      subtotalPaise: lineSubtotals[i],
    }));
    try {
      coupon = await CouponService.evaluate({
        code: input.couponCode,
        lines: ctx,
        userId: input.userId,
      });
    } catch (err) {
      // An invalid coupon must never block pricing — it is reported and dropped.
      couponError = err instanceof Error ? err.message : 'This coupon could not be applied.';
    }
  }

  const discount = coupon?.discountPaise ?? 0;
  const lineDiscounts = apportion(discount, lineSubtotals);

  // ── Shipping ────────────────────────────────────────────────────────────
  // The threshold is tested against the post-discount total, so a coupon
  // cannot be used to claim free shipping the order no longer qualifies for.
  const feesAtCheckout = PaymentService.collectsAddress();
  const netSubtotal = Math.max(0, subtotal - discount);
  const qualifiesFree = freeEnabled && netSubtotal >= freeThreshold;

  // In the bag no payment method has been chosen yet. Prepaid is what the
  // quote assumes, so the headline figure matches the cheaper of the two and
  // the COD surcharge appears only once COD is actually selected.
  const isCod = input.paymentMethod === PaymentMethod.COD;
  const prepaidFreeApplies = prepaidFree && !isCod && itemCount > 0;

  let shipping = itemCount === 0 ? 0 : qualifiesFree || prepaidFreeApplies ? 0 : shipFee;
  if (coupon?.freeShipping) shipping = 0;

  // The gateway adds its own shipping on top of what we send it, so charging
  // ours as well would bill the customer twice. The configured fee still
  // describes the rule to the shopper — it just is not collected here.
  if (feesAtCheckout) shipping = 0;

  const handling = handlingPerItem * itemCount;
  const cod = isCod ? codFee : 0;

  const taxable = netSubtotal + shipping + handling + cod;
  const tax = taxEnabled && taxRate > 0 ? Math.round((taxable * taxRate) / 100) : 0;

  const total = netSubtotal + shipping + handling + cod + tax;

  // What the gateway is expected to add. Kept out of `total`, which is what we
  // hand it — the gateway applies its own rule on top of whatever we send.
  const estimatedShipping =
    itemCount === 0 || qualifiesFree || prepaidFreeApplies || coupon?.freeShipping
      ? 0
      : feesAtCheckout
        ? shipFee
        : 0;

  const breakdown: PricingBreakdown = {
    subtotalPaise: subtotal,
    discountPaise: discount,
    shippingPaise: shipping,
    handlingPaise: handling,
    codFeePaise: cod,
    taxPaise: tax,
    totalPaise: total,
    // Kept even when the gateway charges: "spend X more for free delivery" is
    // true either way, and it is the one number a shopper acts on.
    freeShippingRemainingPaise:
      !freeEnabled || qualifiesFree || prepaidFreeApplies || itemCount === 0
        ? 0
        : Math.max(0, freeThreshold - netSubtotal),
    freeShippingThresholdPaise: freeThreshold,
    feesAtCheckout,
    shippingPolicy: { feePaise: shipFee, freeThresholdPaise: freeThreshold, freeEnabled, prepaidFree },
    estimatedShippingPaise: estimatedShipping,
    estimatedTotalPaise: total + estimatedShipping,
    coupon: coupon
      ? {
          code: coupon.code,
          description: coupon.description,
          discountPaise: coupon.discountPaise,
          freeShipping: coupon.freeShipping,
        }
      : null,
  };

  return { breakdown, lineDiscounts, coupon, couponError };
}
