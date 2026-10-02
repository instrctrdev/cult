import 'server-only';
import { DiscountType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { formatPaise, toPaise } from '@/lib/money';

export interface CouponLineContext {
  productId: string;
  categoryIds: string[];
  /** Line subtotal in paise, after any per-line adjustments. */
  subtotalPaise: number;
}

export interface CouponEvaluation {
  couponId: string;
  code: string;
  description: string | null;
  discountPaise: number;
  freeShipping: boolean;
  /** Lines the discount was computed against, for apportioning. */
  eligibleSubtotalPaise: number;
}

const invalid = (message: string) => new AppError('COUPON_INVALID', message);

/**
 * All coupon rules are enforced here, server-side. The client only ever sends
 * a code string; every constraint (window, limits, minimum, subset, per-user
 * cap, first-order-only) is re-checked against the database.
 */
export const CouponService = {
  async evaluate(params: {
    code: string;
    lines: CouponLineContext[];
    userId?: string | null;
    email?: string | null;
  }): Promise<CouponEvaluation> {
    const code = params.code.trim().toUpperCase();
    if (!code) throw invalid('Enter a coupon code.');

    const coupon = await prisma.coupon.findFirst({
      where: { code, deletedAt: null },
      include: {
        products: { select: { id: true } },
        categories: { select: { id: true } },
        customers: { select: { id: true } },
      },
    });

    if (!coupon || !coupon.isActive) throw invalid('This coupon code is not valid.');

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) throw invalid('This coupon is not active yet.');
    if (coupon.expiresAt && coupon.expiresAt < now) throw invalid('This coupon has expired.');

    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
      throw invalid('This coupon has been fully redeemed.');
    }

    // Customer-specific coupons.
    if (coupon.customers.length > 0) {
      if (!params.userId || !coupon.customers.some((c) => c.id === params.userId)) {
        throw invalid('This coupon is not available on your account.');
      }
    }

    if (params.userId) {
      if (coupon.perUserLimit != null) {
        const used = await prisma.couponUsage.count({
          where: { couponId: coupon.id, userId: params.userId },
        });
        if (used >= coupon.perUserLimit) throw invalid('You have already used this coupon.');
      }
      if (coupon.firstOrderOnly) {
        const priorOrders = await prisma.order.count({
          where: { userId: params.userId, status: { notIn: ['CANCELLED'] } },
        });
        if (priorOrders > 0) throw invalid('This coupon is for first orders only.');
      }
    } else if (coupon.firstOrderOnly || coupon.perUserLimit != null) {
      // Without an account there is no reliable way to enforce a per-customer
      // cap, so these coupons require sign-in rather than being silently free.
      throw invalid('Please sign in to use this coupon.');
    }

    // Which lines the discount applies to.
    const productIds = new Set(coupon.products.map((p) => p.id));
    const categoryIds = new Set(coupon.categories.map((c) => c.id));
    const eligible = coupon.appliesToSubset
      ? params.lines.filter(
          (l) => productIds.has(l.productId) || l.categoryIds.some((id) => categoryIds.has(id)),
        )
      : params.lines;

    if (coupon.appliesToSubset && eligible.length === 0) {
      throw invalid('This coupon does not apply to the items in your bag.');
    }

    const eligibleSubtotal = eligible.reduce((sum, l) => sum + l.subtotalPaise, 0);
    const cartSubtotal = params.lines.reduce((sum, l) => sum + l.subtotalPaise, 0);

    if (coupon.minOrderAmount) {
      const min = toPaise(coupon.minOrderAmount);
      if (cartSubtotal < min) {
        const shortfall = min - cartSubtotal;
        throw new AppError(
          'COUPON_INVALID',
          `Add ${formatPaise(shortfall)} more to use this coupon.`,
          { shortfallPaise: shortfall },
        );
      }
    }

    let discount: number;
    if (coupon.type === DiscountType.PERCENTAGE) {
      discount = Math.floor((eligibleSubtotal * Number(coupon.value)) / 100);
      if (coupon.maxDiscount) discount = Math.min(discount, toPaise(coupon.maxDiscount));
    } else {
      discount = toPaise(coupon.value);
    }

    // A discount can never exceed what it applies to.
    discount = Math.max(0, Math.min(discount, eligibleSubtotal));

    if (discount === 0 && !coupon.freeShipping) {
      throw invalid('This coupon gives no discount on your current bag.');
    }

    return {
      couponId: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discountPaise: discount,
      freeShipping: coupon.freeShipping,
      eligibleSubtotalPaise: eligibleSubtotal,
    };
  },

  /** Called inside the order transaction so counters stay consistent. */
  async recordUsage(
    tx: Prisma.TransactionClient,
    params: { couponId: string; orderId: string; userId?: string | null; amountPaise: number },
  ): Promise<void> {
    await tx.coupon.update({
      where: { id: params.couponId },
      data: { usedCount: { increment: 1 } },
    });
    await tx.couponUsage.create({
      data: {
        couponId: params.couponId,
        orderId: params.orderId,
        userId: params.userId ?? null,
        amount: new Prisma.Decimal(params.amountPaise).div(100).toDecimalPlaces(2),
      },
    });
  },

  /** Reverses a redemption when an order is cancelled before fulfilment. */
  async releaseUsage(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const usages = await tx.couponUsage.findMany({ where: { orderId }, select: { id: true, couponId: true } });
    for (const u of usages) {
      await tx.coupon.update({
        where: { id: u.couponId },
        data: { usedCount: { decrement: 1 } },
      });
      await tx.couponUsage.delete({ where: { id: u.id } });
    }
  },
};
