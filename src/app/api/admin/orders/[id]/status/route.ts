import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { OrderService } from '@/services/order.service';
import { AuditService } from '@/services/audit.service';
import { adminOrderStatusSchema } from '@/lib/validation';
import { clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/orders/[id]/status — manual status transition.
 *
 * Stock consequences (restocking a return) are applied inside the service, so
 * a status change can never silently desynchronise inventory.
 */
export const PATCH = withErrorHandling(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requirePermission('orders.write');
  const { id } = await ctx.params;

  const { status, message } = adminOrderStatusSchema.parse(await req.json());

  if (status === 'CANCELLED') {
    // Cancelling has to release stock and coupon usage, which `cancel` handles.
    await OrderService.cancel(id, message ?? 'Cancelled by admin', actor.id);
  } else {
    await OrderService.updateStatus(id, status, actor.id, message);
  }

  await AuditService.log({
    actorId: actor.id,
    action: 'order.status',
    entityType: 'Order',
    entityId: id,
    changes: { after: { status, message } },
    ip: clientIp(req.headers),
  });

  return NextResponse.json({ ok: true });
});
