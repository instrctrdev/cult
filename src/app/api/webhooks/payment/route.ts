import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { PaymentService } from '@/services/payment.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/webhooks/payment
 *
 * The raw body is read as text because the HMAC is computed over the exact
 * bytes sent — parsing to JSON first would break signature verification.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const rawBody = await req.text();
  const result = await PaymentService.handleWebhook(rawBody, req.headers);
  return NextResponse.json(result);
});
