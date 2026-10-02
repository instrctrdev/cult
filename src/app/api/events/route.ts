import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { CustomerEventType } from '@prisma/client';
import { withErrorHandling } from '@/lib/errors';
import { randomBytes } from 'crypto';
import { getCurrentUser, GUEST_CART_COOKIE, VISITOR_COOKIE } from '@/lib/auth/session';
import { CustomerEventService } from '@/services/customer-event.service';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const eventSchema = z.object({
  /** Only the events a browser is allowed to assert. A purchase is recorded
   *  server-side at settlement, never on a client's say-so. */
  eventType: z.enum(['PRODUCT_VIEW']),
  productSlug: z.string().trim().min(1).max(191),
});

/**
 * POST /api/events — records a product view.
 *
 * A beacon rather than a server-side write inside the product page: those
 * pages are statically generated and revalidated every five minutes, so a
 * view recorded during render would miss every cached hit and would tie
 * analytics to the render path.
 *
 * The product is looked up by slug rather than trusting an id from the
 * browser, so a caller cannot invent events against arbitrary rows.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  enforceRateLimit({ key: 'events', identifier: clientIp(req.headers), limit: 120, windowSeconds: 60 });

  const body = eventSchema.parse(await req.json());
  const user = await getCurrentUser();
  const jar = await cookies();

  /**
   * A first-time visitor has no cart cookie yet, and dropping their view
   * meant only shoppers who already had a bag were counted as having
   * looked — while everyone who added to one was. The funnel then compared
   * two different populations and could report over 100% conversion.
   *
   * So an anonymous id is issued here when there is none. It is first-party,
   * carries nothing about the person, and exists only to line the stages of
   * the store's own funnel up against each other.
   */
  let guestToken: string | null = null;
  let issued: string | null = null;
  if (!user) {
    guestToken = jar.get(GUEST_CART_COOKIE)?.value ?? jar.get(VISITOR_COOKIE)?.value ?? null;
    if (!guestToken) {
      guestToken = randomBytes(16).toString('base64url');
      issued = guestToken;
    }
  }

  const product = await prisma.product.findUnique({
    where: { slug: body.productSlug },
    select: { id: true, deletedAt: true },
  });
  if (!product || product.deletedAt) return NextResponse.json({ ok: true });

  await CustomerEventService.record({
    eventType: CustomerEventType.PRODUCT_VIEW,
    userId: user?.id ?? null,
    guestToken,
    productId: product.id,
  });

  const res = NextResponse.json({ ok: true });
  if (issued) {
    res.cookies.set(VISITOR_COOKIE, issued, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
});
