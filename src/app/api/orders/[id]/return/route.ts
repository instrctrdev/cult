import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandling } from '@/lib/errors';
import { requireUser } from '@/lib/auth/session';
import { OrderService } from '@/services/order.service';

export const dynamic = 'force-dynamic';

/** POST /api/orders/[id]/return — raises a return request within the window. */
export const POST = withErrorHandling(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const { reason } = z
    .object({ reason: z.string().trim().min(3, 'Please tell us why.').max(255) })
    .parse(await req.json());

  await OrderService.requestReturn(id, reason, user.id);
  return NextResponse.json({ ok: true });
});
