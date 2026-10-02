import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { PaymentService } from '@/services/payment.service';
import { AuditService } from '@/services/audit.service';
import { adminRefundSchema } from '@/lib/validation';
import { clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** POST /api/admin/orders/[id]/refund — gated behind the orders.refund permission. */
export const POST = withErrorHandling(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requirePermission('orders.refund');
  const { id } = await ctx.params;

  const { amount, reason } = adminRefundSchema.parse(await req.json());
  // Rupees in, paise through the service — refunds are validated against the
  // amount actually captured.
  const result = await PaymentService.refund(id, Math.round(amount * 100), reason);

  await AuditService.log({
    actorId: actor.id,
    action: 'order.refund',
    entityType: 'Order',
    entityId: id,
    changes: { after: { amount, reason } },
    ip: clientIp(req.headers),
  });

  return NextResponse.json(result);
});
