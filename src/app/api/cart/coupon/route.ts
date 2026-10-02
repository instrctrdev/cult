import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { getCurrentUser } from '@/lib/auth/session';
import { CartService } from '@/services/cart.service';
import { couponCodeSchema } from '@/lib/validation';
import { enforceRateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cart/coupon — validate and attach a code.
 * Rate-limited because this endpoint would otherwise allow brute-forcing
 * unknown coupon codes.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  enforceRateLimit({ key: 'coupon', identifier: clientIp(req.headers), limit: 10, windowSeconds: 300 });

  const user = await getCurrentUser();
  const { code } = couponCodeSchema.parse(await req.json());
  const cart = await CartService.applyCoupon(user?.id ?? null, code);
  return NextResponse.json(cart);
});

export const DELETE = withErrorHandling(async () => {
  const user = await getCurrentUser();
  const cart = await CartService.removeCoupon(user?.id ?? null);
  return NextResponse.json(cart);
});
