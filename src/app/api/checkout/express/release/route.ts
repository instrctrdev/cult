import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandling } from '@/lib/errors';
import { CheckoutIntentService } from '@/services/checkout-intent.service';

export const dynamic = 'force-dynamic';

const settleSchema = z.object({
  reference: z.string().min(1).max(191),
});

/**
 * POST /api/checkout/express/release — called when Cashfree's sheet closes.
 *
 * The sheet closing says nothing about whether the customer paid, so the
 * gateway is asked. If it did, the order is created now (this is the only
 * moment an order comes into being for an express checkout). If it did not,
 * there is nothing to undo: no order was ever created and no stock was ever
 * reserved, so the reply simply says so.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const { reference } = settleSchema.parse(await req.json());

  const result = await CheckoutIntentService.settle(reference).catch((err) => {
    console.error('[express-release] settle failed', { reference }, err);
    return null;
  });

  if (!result) return NextResponse.json({ paid: false, orderNumber: null });

  return NextResponse.json({
    paid: result.paid,
    orderNumber: result.order?.orderNumber ?? null,
  });
});
