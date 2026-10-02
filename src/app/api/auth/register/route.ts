import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { registerSchema } from '@/lib/validation';
import { CustomerService } from '@/services/customer.service';
import { CartService } from '@/services/cart.service';
import { createSession } from '@/lib/auth/session';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';
import { cookies } from 'next/headers';
import { GUEST_CART_COOKIE, VISITOR_COOKIE } from '@/lib/auth/session';
import { CustomerEventService } from '@/services/customer-event.service';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (req: NextRequest) => {
  const ip = clientIp(req.headers);
  enforceRateLimit({ key: 'register', identifier: ip, limit: 5, windowSeconds: 3600 });

  const body = registerSchema.parse(await req.json());
  const user = await CustomerService.register(body);
  const jar = await cookies();
  const guestTokens = [jar.get(VISITOR_COOKIE)?.value, jar.get(GUEST_CART_COOKIE)?.value];

  await createSession(user.id, user.email, user.role);
  await CustomerEventService.claimGuestEvents(user.id, guestTokens);
  // Anything the customer put in the bag before signing up follows them in.
  await CartService.mergeGuestCart(user.id);

  return NextResponse.json({
    user: { id: user.id, email: user.email, firstName: user.firstName, role: user.role },
  });
});
