import { NextResponse, type NextRequest } from 'next/server';
import { Prisma, ProductStatus } from '@prisma/client';
import { withErrorHandling, conflict } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/audit.service';
import { adminProductSchema } from '@/lib/validation';
import { slugify } from '@/lib/utils';
import { clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** POST /api/admin/products — create a product (variants are added separately). */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const actor = await requirePermission('products.write');
  const body = adminProductSchema.parse(await req.json());

  const slug = body.slug || slugify(body.name);
  const clash = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  if (clash) throw conflict('A product with that URL slug already exists.');

  const product = await prisma.product.create({
    data: {
      slug,
      name: body.name,
      subtitle: body.subtitle ?? null,
      description: body.description ?? null,
      details: (body.details ?? []) as unknown as Prisma.InputJsonValue,
      fabric: body.fabric ?? null,
      fit: body.fit ?? null,
      sizeChartImage: body.sizeChartImage ?? null,
      price: new Prisma.Decimal(body.price),
      compareAtPrice: body.compareAtPrice ? new Prisma.Decimal(body.compareAtPrice) : null,
      status: body.status as ProductStatus,
      // Publishing is what makes a product visible; DRAFT stays hidden.
      publishedAt: body.status === 'ACTIVE' ? new Date() : null,
      isFeatured: body.isFeatured,
      isNewArrival: body.isNewArrival,
      isBestSeller: body.isBestSeller,
      metaTitle: body.metaTitle ?? null,
      metaDescription: body.metaDescription ?? null,
      categories: { create: body.categoryIds.map((categoryId, i) => ({ categoryId, position: i })) },
    },
    select: { id: true, slug: true },
  });

  await AuditService.log({
    actorId: actor.id, action: 'product.create', entityType: 'Product',
    entityId: product.id, changes: { after: body }, ip: clientIp(req.headers),
  });

  return NextResponse.json(product, { status: 201 });
});
