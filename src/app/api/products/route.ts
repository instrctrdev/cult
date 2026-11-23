import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { ProductService } from '@/services/product.service';
import { parseQuery, productQuerySchema } from '@/lib/validation';

/**
 * GET /api/products — the listing endpoint behind infinite scroll.
 *
 * Every parameter is parsed through Zod; the database is never queried from
 * raw client input.
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const q = parseQuery(productQuerySchema, req.nextUrl.searchParams);

  const result = await ProductService.list({
    collection: q.collection,
    categorySlugs: q.category?.split(',').filter(Boolean),
    sizeCodes: q.size?.split(',').filter(Boolean),
    colorSlugs: q.color?.split(',').filter(Boolean),
    minPricePaise: q.minPrice != null ? q.minPrice * 100 : undefined,
    maxPricePaise: q.maxPrice != null ? q.maxPrice * 100 : undefined,
    inStockOnly: Boolean(q.inStock),
    onSaleOnly: Boolean(q.onSale),
    search: q.q,
    sort: q.sort,
    page: q.page,
    perPage: q.perPage,
  });

  return NextResponse.json(result, {
    // Availability shares inventory with offline billing and must be current.
    headers: { 'Cache-Control': 'no-store' },
  });
});
