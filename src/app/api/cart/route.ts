import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { getCurrentUser } from '@/lib/auth/session';
import { CartService } from '@/services/cart.service';

export const dynamic = 'force-dynamic';

/** GET /api/cart — the caller's cart with server-computed totals. */
export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser();
  const cart = await CartService.get(user?.id ?? null);
  return NextResponse.json(cart, { headers: { 'Cache-Control': 'private, no-store' } });
});
