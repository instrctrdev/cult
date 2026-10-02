import { NextResponse } from 'next/server';
import { withErrorHandling, notFound } from '@/lib/errors';
import { ProductService } from '@/services/product.service';

/** GET /api/products/[slug] — full detail, used by Quick Add and the PDP client. */
export const GET = withErrorHandling(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const product = await ProductService.getBySlug(slug);
  if (!product) throw notFound('Product not found.');

  return NextResponse.json(product, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
});
