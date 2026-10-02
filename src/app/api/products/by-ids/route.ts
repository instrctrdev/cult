import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandling } from '@/lib/errors';
import { ProductService } from '@/services/product.service';

export const dynamic = 'force-dynamic';

/** POST /api/products/by-ids — resolves a client-held id list (guest wishlist). */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const { ids } = z
    .object({ ids: z.array(z.string().max(64)).max(100) })
    .parse(await req.json());

  const products = await ProductService.byIds(ids);
  return NextResponse.json({ products });
});
