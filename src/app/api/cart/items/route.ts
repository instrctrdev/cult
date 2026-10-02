import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling, badRequest } from '@/lib/errors';
import { getCurrentUser } from '@/lib/auth/session';
import { CartService } from '@/services/cart.service';
import { addToCartSchema, updateCartItemSchema } from '@/lib/validation';
import { enforceRateLimit, clientIp } from '@/lib/rate-limit';
import { CustomerEventService } from '@/services/customer-event.service';
import { CustomerEventType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { GUEST_CART_COOKIE, VISITOR_COOKIE } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** POST /api/cart/items — add a variant to the bag. */
export const POST = withErrorHandling(async (req: NextRequest) => {
  enforceRateLimit({ key: 'cart-write', identifier: clientIp(req.headers), limit: 60, windowSeconds: 60 });

  const user = await getCurrentUser();
  const body = addToCartSchema.parse(await req.json());
  const cart = await CartService.addItem(user?.id ?? null, body.variantId, body.quantity);

  // Recorded after the fact so tracking can never fail an add to bag.
  const variant = await prisma.productVariant
    .findUnique({ where: { id: body.variantId }, select: { productId: true } })
    .catch(() => null);
  await CustomerEventService.record({
    eventType: CustomerEventType.ADD_TO_CART,
    userId: user?.id ?? null,
    // Same identity the view was recorded under, or the two funnel stages
    // describe two different people.
    guestToken: user
      ? null
      : (await cookies()).get(VISITOR_COOKIE)?.value ?? (await cookies()).get(GUEST_CART_COOKIE)?.value ?? null,
    productId: variant?.productId ?? null,
    cartId: cart.id,
  });

  return NextResponse.json(cart);
});

/** PATCH /api/cart/items — change a line quantity (0 removes it). */
export const PATCH = withErrorHandling(async (req: NextRequest) => {
  enforceRateLimit({ key: 'cart-write', identifier: clientIp(req.headers), limit: 60, windowSeconds: 60 });

  const user = await getCurrentUser();
  const body = updateCartItemSchema.parse(await req.json());
  const cart = await CartService.updateItem(user?.id ?? null, body.itemId, body.quantity);
  return NextResponse.json(cart);
});

/** DELETE /api/cart/items?itemId=… */
export const DELETE = withErrorHandling(async (req: NextRequest) => {
  const user = await getCurrentUser();
  const itemId = req.nextUrl.searchParams.get('itemId');
  if (!itemId) throw badRequest('itemId is required.');

  const cart = await CartService.removeItem(user?.id ?? null, itemId);
  return NextResponse.json(cart);
});
