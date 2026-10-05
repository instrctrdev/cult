import { NextResponse, type NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/session';
import { badRequest, notFound, withErrorHandling } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { toPaise } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (req: NextRequest) => {
  await requirePermission('orders.read');
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (!q || q.length > 100) throw badRequest('Enter a barcode, SKU, or product name.');
  const variants = await prisma.productVariant.findMany({
    where: {
      isActive: true, deletedAt: null, product: { deletedAt: null },
      OR: [{ id: q }, { sku: q }, { sku: { contains: q } }, { product: { name: { contains: q } } }],
    },
    orderBy: { sku: 'asc' }, take: 20,
    include: { product: true, size: true, color: true, inventory: true },
  });
  if (!variants.length) throw notFound('No product found for that scan or search.');
  return NextResponse.json({ items: variants.map((v) => ({
    id: v.id, sku: v.sku, name: v.product.name, brand: v.product.vendor,
    variant: [v.size?.label, v.color?.name].filter(Boolean).join(' / '),
    pricePaise: toPaise(v.price),
    mrpPaise: toPaise(v.compareAtPrice && v.compareAtPrice.greaterThan(v.price) ? v.compareAtPrice : v.price),
    available: v.inventory?.allowBackorder ? 999999 : Math.max(0, (v.inventory?.quantity ?? 0) - (v.inventory?.reserved ?? 0)),
  })) });
});
