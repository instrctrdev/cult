import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandling, notFound } from '@/lib/errors';
import { requireUser } from '@/lib/auth/session';
import { OrderService } from '@/services/order.service';

export const dynamic = 'force-dynamic';

/** POST /api/orders/[id]/cancel — customer-initiated cancellation. */
export const POST = withErrorHandling(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  // Confirms ownership before any state change.
  const order = await OrderService.getById(id, user.id);
  if (!order) throw notFound('Order not found.');

  const { reason } = z
    .object({ reason: z.string().trim().min(1).max(255).default('Cancelled by customer') })
    .parse(await req.json().catch(() => ({})));

  await OrderService.cancel(id, reason);
  return NextResponse.json({ ok: true });
});
