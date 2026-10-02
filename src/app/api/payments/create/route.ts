import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandling, notFound } from '@/lib/errors';
import { getCurrentUser } from '@/lib/auth/session';
import { PaymentService } from '@/services/payment.service';
import { OrderService } from '@/services/order.service';
import { publicEnv } from '@/lib/env';
import { cuidSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/create — opens a gateway session for an existing order.
 * The amount comes from the stored order, never from the request.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await getCurrentUser();
  const { orderId } = z.object({ orderId: cuidSchema }).parse(await req.json());

  // A signed-in customer may only pay for their own order.
  const order = await OrderService.getById(orderId, user?.id);
  if (!order) throw notFound('Order not found.');

  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  const result = await PaymentService.createPayment(
    orderId,
    `${base}/checkout/confirmation/${order.orderNumber}`,
    `${base}/api/webhooks/payment`,
  );

  return NextResponse.json(result);
});
