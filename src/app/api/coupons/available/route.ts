import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { CartService } from '@/services/cart.service';
import { toPaise } from '@/lib/money';

export const dynamic = 'force-dynamic';

/**
 * GET /api/coupons/available — offers worth showing on the current bag.
 *
 * Only codes anyone could use: nothing restricted to named customers, nothing
 * exhausted, nothing outside its dates. A code the shopper cannot yet afford is
 * still returned, marked with what it needs — "spend Rs. 200 more to use this"
 * is the useful half of the message, and hiding it would just look like the
 * offer does not exist.
 *
 * Deliberately never reveals a coupon's own limits beyond the minimum spend;
 * the checkout re-validates every code on the server regardless of what was
 * shown here.
 */
export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser();
  const cart = await CartService.get(user?.id ?? null);
  const subtotalPaise = cart.pricing.subtotalPaise - cart.pricing.discountPaise;

  const now = new Date();
  const coupons = await prisma.coupon.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
      ],
      // A code reserved for specific customers is not a public offer.
      customers: { none: {} },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      code: true, description: true, type: true, value: true,
      minOrderAmount: true, usageLimit: true, usedCount: true, freeShipping: true,
      firstOrderOnly: true,
    },
  });

  const offers = coupons
    // Fully redeemed codes are gone, not "nearly available".
    .filter((c) => c.usageLimit == null || c.usedCount < c.usageLimit)
    // A first-order-only code is noise for someone who has already ordered.
    .filter((c) => !c.firstOrderOnly || !user)
    .map((c) => {
      const minPaise = c.minOrderAmount ? toPaise(c.minOrderAmount) : 0;
      return {
        code: c.code,
        description: c.description,
        // A free-shipping code often carries a zero value of either type, so
        // that is checked before the discount is described — "0% off" is not
        // an offer anyone would claim.
        label:
          c.freeShipping && Number(c.value) === 0
            ? 'Free delivery'
            : c.type === 'PERCENTAGE'
              ? `${Number(c.value)}% off`
              : `Rs. ${Number(c.value)} off`,
        minOrderPaise: minPaise,
        /** Short of the minimum spend; 0 when it can be used right now. */
        shortfallPaise: Math.max(0, minPaise - subtotalPaise),
      };
    })
    .sort((a, b) => a.shortfallPaise - b.shortfallPaise);

  return NextResponse.json({ offers }, { headers: { 'Cache-Control': 'private, no-store' } });
});
