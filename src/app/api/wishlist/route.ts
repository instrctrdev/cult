import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandling } from '@/lib/errors';
import { getCurrentUser, requireUser } from '@/lib/auth/session';
import { WishlistService } from '@/services/wishlist.service';
import { cuidSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** GET /api/wishlist — product ids only; the grid is rendered server-side. */
export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ productIds: [] });

  const productIds = await WishlistService.productIds(user.id);
  return NextResponse.json({ productIds }, { headers: { 'Cache-Control': 'private, no-store' } });
});

/** POST /api/wishlist — toggle a product. Requires an account. */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await requireUser();
  const { productId } = z.object({ productId: cuidSchema }).parse(await req.json());
  const result = await WishlistService.toggle(user.id, productId);
  return NextResponse.json(result);
});
