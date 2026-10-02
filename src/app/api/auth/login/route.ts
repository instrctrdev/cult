import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandling, AppError } from '@/lib/errors';
import { loginSchema } from '@/lib/validation';
import { CustomerService } from '@/services/customer.service';
import { CartService } from '@/services/cart.service';
import { WishlistService } from '@/services/wishlist.service';
import { createSession } from '@/lib/auth/session';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';
import { cookies } from 'next/headers';
import { GUEST_CART_COOKIE, VISITOR_COOKIE } from '@/lib/auth/session';
import { CustomerEventService } from '@/services/customer-event.service';

export const dynamic = 'force-dynamic';

const bodySchema = loginSchema.extend({
  /** Guest wishlist ids to fold into the account on sign-in. */
  wishlistIds: z.array(z.string().max(64)).max(200).optional(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const ip = clientIp(req.headers);
  const body = bodySchema.parse(await req.json());

  // Two budgets: one per IP to stop spraying, one per account to stop
  // targeted brute force from rotating addresses.
  enforceRateLimit({ key: 'login-ip', identifier: ip, limit: 20, windowSeconds: 900 });
  enforceRateLimit({ key: 'login-user', identifier: body.email, limit: 8, windowSeconds: 900 });

  const user = await CustomerService.authenticate(body.email, body.password);
  if (!user) {
    // Identical message for unknown email and wrong password.
    throw new AppError('UNAUTHENTICATED', 'That email and password combination is not correct.');
  }

  const jar = await cookies();
  const guestTokens = [jar.get(VISITOR_COOKIE)?.value, jar.get(GUEST_CART_COOKIE)?.value];

  await createSession(user.id, user.email, user.role);
  await CustomerEventService.claimGuestEvents(user.id, guestTokens);
  await CartService.mergeGuestCart(user.id);
  if (body.wishlistIds?.length) await WishlistService.mergeLocal(user.id, body.wishlistIds);

  return NextResponse.json({
    user: { id: user.id, email: user.email, firstName: user.firstName, role: user.role },
  });
});
