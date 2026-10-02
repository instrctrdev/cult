import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandling } from '@/lib/errors';
import { PaymentService } from '@/services/payment.service';
import { cuidSchema } from '@/lib/validation';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/verify — re-checks payment status directly with the
 * gateway.
 *
 * This exists because the browser's "payment succeeded" callback is not
 * evidence of anything. The order is only marked paid by this server-side
 * check or by a signed webhook.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  enforceRateLimit({ key: 'pay-verify', identifier: clientIp(req.headers), limit: 30, windowSeconds: 300 });

  const { orderId } = z.object({ orderId: cuidSchema }).parse(await req.json());
  const result = await PaymentService.verifyAndSettle(orderId);
  return NextResponse.json(result);
});
