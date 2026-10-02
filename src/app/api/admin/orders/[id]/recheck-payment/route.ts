import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling, badRequest, notFound } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { OrderService } from '@/services/order.service';
import { PaymentService } from '@/services/payment.service';
import { AuditService } from '@/services/audit.service';
import { clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/orders/[id]/recheck-payment — manually re-run gateway
 * verification for a prepaid order stuck in PENDING.
 *
 * The customer's own confirmation-page visit is normally what triggers this;
 * an order can be left unverified if that page was never reached (a closed
 * tab, a lost connection, or — until this was fixed — a checkout flow that
 * never navigated there at all). Re-running it here is exactly what would
 * have happened on that visit: it re-checks with the gateway, and on success
 * captures the real delivery address One Click Checkout collected.
 */
export const POST = withErrorHandling(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requirePermission('orders.write');
  const { id } = await ctx.params;

  const order = await OrderService.getById(id);
  if (!order) throw notFound('Order not found.');
  if (order.paymentMethod !== 'PREPAID') throw badRequest('Only prepaid orders have a gateway payment to recheck.');

  const result = await PaymentService.verifyAndSettle(id);

  await AuditService.log({
    actorId: actor.id,
    action: 'order.recheck_payment',
    entityType: 'Order',
    entityId: id,
    changes: { after: { paymentStatus: result.status, settled: result.settled } },
    ip: clientIp(req.headers),
  });

  return NextResponse.json(result);
});
