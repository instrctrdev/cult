import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling, notFound } from '@/lib/errors';
import { OrderService } from '@/services/order.service';
import { trackOrderSchema } from '@/lib/validation';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/orders/track — guest order lookup.
 *
 * Requires the order number AND the email it was placed with, so order numbers
 * cannot be enumerated. Rate-limited for the same reason.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  enforceRateLimit({ key: 'track', identifier: clientIp(req.headers), limit: 15, windowSeconds: 600 });

  const { orderNumber, email } = trackOrderSchema.parse(await req.json());
  const order = await OrderService.getByNumber(orderNumber.toUpperCase(), email);
  if (!order) throw notFound('We could not find an order with those details.');

  return NextResponse.json({ order });
});
