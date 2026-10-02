import { NextResponse, type NextRequest } from 'next/server';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import { withErrorHandling, forbidden } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { PaymentService } from '@/services/payment.service';
import { OrderService } from '@/services/order.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/expire-orders — releases stock reserved by checkouts nobody
 * ever finished.
 *
 * A prepaid order a customer abandons (closes the tab, the payment sheet
 * times out) has no webhook and no browser return to tell us it failed —
 * Cashfree just leaves it ACTIVE until `order_expiry_time` passes. Until
 * something re-checks it, the order sits at PENDING forever and the stock
 * `reserve()` took at checkout is never released, so the item can look sold
 * out even though nobody paid for it.
 *
 * This finds every prepaid order still PENDING well past that expiry and
 * re-verifies each one with `verifyAndSettle` — the exact same call the
 * confirmation page makes, so a genuinely-late payment still gets credited
 * correctly. Only a real gateway response of FAILED/EXPIRED cancels the
 * order and releases its stock; nothing here assumes failure on its own.
 *
 * Requires `Authorization: Bearer <CRON_SECRET>` — scheduled by a Hostinger
 * cron job hitting this route directly, not by anything user-facing.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const secret = env().CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    throw forbidden('Invalid or missing cron secret.');
  }

  // 20-minute Cashfree expiry plus 5 minutes of slack, so a payment that is
  // merely slow to confirm is never swept up as abandoned. Nothing is
  // cancelled on age alone — `verifyAndSettle` still asks the gateway, and
  // only a genuine FAILED/EXPIRED releases the stock.
  const cutoff = new Date(Date.now() - 25 * 60 * 1000);

  /**
   * A verify that keeps failing used to strand an order in PENDING forever,
   * holding its stock — orders whose gateway session no longer exists at all
   * (404) can never settle, so asking again tomorrow changes nothing. Past
   * this age an unpaid order is cancelled on its own merits: it is far beyond
   * any session lifetime, and the stock belongs back on the shelf.
   */
  const abandonedCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const stale = await prisma.order.findMany({
    where: { status: OrderStatus.PENDING, paymentMethod: PaymentMethod.PREPAID, placedAt: { lt: cutoff } },
    select: { id: true, orderNumber: true, placedAt: true },
    take: 100,
  });

  const results = await Promise.allSettled(
    stale.map((order) => PaymentService.verifyAndSettle(order.id)),
  );

  const settled = results.filter((r) => r.status === 'fulfilled' && r.value.settled).length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  // Anything still PENDING and long past its session gets released, whether
  // the gateway answered or not.
  let released = 0;
  for (const order of stale) {
    if (order.placedAt >= abandonedCutoff) continue;

    const current = await prisma.order.findUnique({ where: { id: order.id }, select: { status: true } });
    if (current?.status !== OrderStatus.PENDING) continue;

    await OrderService.cancel(order.id, 'Payment was never completed.')
      .then(() => { released += 1; })
      .catch((err) => console.error('[expire-orders] releasing stale order failed', order.orderNumber, err));
  }

  // Intents nobody paid for hold nothing — no order, no stock — so they are
  // simply tidied away rather than "released".
  const { count: intentsPurged } = await prisma.checkoutIntent.deleteMany({
    where: { orderId: null, createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
  });

  return NextResponse.json({ checked: stale.length, settled, failed, released, intentsPurged });
});
