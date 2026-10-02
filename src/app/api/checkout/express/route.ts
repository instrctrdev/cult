import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';
import { withErrorHandling, badRequest } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { CartService } from '@/services/cart.service';
import { CustomerService } from '@/services/customer.service';
import { CheckoutIntentService, type IntentLine } from '@/services/checkout-intent.service';
import { PaymentService } from '@/services/payment.service';
import { quote } from '@/services/pricing.service';
import { toPaise } from '@/lib/money';
import { cuidSchema } from '@/lib/validation';
import { PENDING_EMAIL, PENDING_PHONE, PENDING_NAME } from '@/lib/checkout/placeholders';
import { publicEnv } from '@/lib/env';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const expressSchema = z.object({
  idempotencyKey: z.string().uuid('A valid idempotency key is required.'),
  /** Present for "Buy now"; absent to buy everything in the bag. */
  buyNow: z
    .object({
      variantId: cuidSchema,
      quantity: z.coerce.number().int().min(1).max(10).default(1),
    })
    .optional(),
  couponCode: z.string().trim().max(64).optional().nullable(),
});

/**
 * POST /api/checkout/express — one call, straight to the payment sheet.
 *
 * Nothing is created here but a CheckoutIntent: no order, and no stock
 * reserved. An order the customer never paid for should not exist at all, and
 * stock they never bought should stay on the shelf — so both are deferred to
 * `CheckoutIntentService.settle`, which runs only once the gateway confirms
 * the money arrived. A customer who backs out leaves nothing behind.
 *
 * Only available when One Click Checkout is actually on: without it nobody
 * would ever collect an address, so the route refuses rather than creating an
 * undeliverable order. Cashfree One Click Checkout is the only checkout path.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  enforceRateLimit({ key: 'checkout', identifier: clientIp(req.headers), limit: 15, windowSeconds: 600 });

  if (!PaymentService.collectsAddress()) {
    throw badRequest('Cashfree One Click Checkout is unavailable right now. Please try again later.');
  }

  const user = await getCurrentUser();
  const body = expressSchema.parse(await req.json());

  const profile = user ? await CustomerService.getProfile(user.id) : null;
  const addresses = user ? await CustomerService.listAddresses(user.id) : [];
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;

  // What is being bought, snapshotted now so a later cart edit cannot change
  // what the customer actually paid for.
  const cart = body.buyNow ? null : await CartService.resolveCart(user?.id ?? null, false);
  if (!body.buyNow && (!cart || cart.items.length === 0)) throw badRequest('Your bag is empty.');

  const lines: IntentLine[] = body.buyNow
    ? [{ variantId: body.buyNow.variantId, quantity: body.buyNow.quantity }]
    : cart!.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));

  // Re-read every price from the database — nothing is taken from the client.
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: lines.map((l) => l.variantId) }, isActive: true, deletedAt: null },
    select: {
      id: true, price: true,
      product: {
        select: { id: true, name: true, status: true, deletedAt: true, categories: { select: { categoryId: true } } },
      },
    },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  const priceable = lines
    .map((l) => ({ line: l, variant: byId.get(l.variantId) }))
    .filter((r) => r.variant && r.variant.product.status === 'ACTIVE' && !r.variant.product.deletedAt)
    .map(({ line, variant }) => ({
      productId: variant!.product.id,
      variantId: variant!.id,
      categoryIds: variant!.product.categories.map((c) => c.categoryId),
      unitPricePaise: toPaise(variant!.price),
      quantity: line.quantity,
      name: variant!.product.name,
    }));

  if (priceable.length === 0) {
    throw badRequest(body.buyNow ? 'This item is no longer available.' : 'The items in your bag are no longer available.');
  }

  const couponCode = body.couponCode ?? (body.buyNow ? null : cart?.coupon?.code ?? null);
  const priced = await quote({
    lines: priceable,
    couponCode,
    // Cashfree's sheet offers COD itself; the session opens as prepaid and the
    // order is created as COD instead if that is what the customer chose.
    paymentMethod: PaymentMethod.PREPAID,
    userId: user?.id ?? null,
  });

  const intent = await CheckoutIntentService.create({
    idempotencyKey: body.idempotencyKey,
    userId: user?.id ?? null,
    email: user?.email ?? PENDING_EMAIL,
    phone: profile?.phone ?? defaultAddress?.phone ?? PENDING_PHONE,
    lines: priceable.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
    couponCode,
    cartId: body.buyNow ? null : cart?.id ?? null,
    amountPaise: priced.breakdown.totalPaise,
  });

  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  const session = await PaymentService.createSessionForIntent({
    reference: intent.reference,
    amountPaise: intent.amountPaise,
    customer: {
      name: defaultAddress?.fullName ?? PENDING_NAME,
      email: intent.email,
      phone: intent.phone,
    },
    lines: priceable.map((l) => ({
      variantId: l.variantId,
      quantity: l.quantity,
      name: l.name,
      unitPricePaise: l.unitPricePaise,
    })),
    couponCode,
    returnUrl: `${base}/checkout/confirmation/${intent.reference}`,
    notifyUrl: `${base}/api/webhooks/payment`,
  });

  return NextResponse.json(
    {
      reference: intent.reference,
      amountPaise: intent.amountPaise,
      paymentSessionId: (session.clientConfig as { paymentSessionId?: string } | undefined)?.paymentSessionId ?? null,
      redirectUrl: session.redirectUrl ?? null,
    },
    { status: 201 },
  );
});
