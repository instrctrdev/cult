import { NextResponse, type NextRequest } from 'next/server';
import { Prisma, ProductStatus } from '@prisma/client';
import { withErrorHandling, notFound, conflict } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/audit.service';
import { adminProductSchema } from '@/lib/validation';
import { slugify } from '@/lib/utils';
import { clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  const actor = await requirePermission('products.write');
  const { id } = await ctx.params;

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw notFound('Product not found.');

  const body = adminProductSchema.parse(await req.json());
  const slug = body.slug || slugify(body.name);

  if (slug !== existing.slug) {
    const clash = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (clash) throw conflict('A product with that URL slug already exists.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Categories are replaced wholesale so removals actually take effect.
    await tx.productCategory.deleteMany({ where: { productId: id } });
    if (body.categoryIds.length) {
      await tx.productCategory.createMany({
        data: body.categoryIds.map((categoryId, i) => ({ productId: id, categoryId, position: i })),
      });
    }

    return tx.product.update({
      where: { id },
      data: {
        slug,
        name: body.name,
        vendor: body.vendor,
        subtitle: body.subtitle ?? null,
        description: body.description ?? null,
        details: (body.details ?? []) as unknown as Prisma.InputJsonValue,
        fabric: body.fabric ?? null,
        fit: body.fit ?? null,
        sizeChartImage: body.sizeChartImage ?? null,
        status: body.status as ProductStatus,
        // Keep the original publish date when re-saving an already-live product.
        publishedAt: body.status === 'ACTIVE' ? existing.publishedAt ?? new Date() : null,
        isFeatured: body.isFeatured,
        isNewArrival: body.isNewArrival,
        isBestSeller: body.isBestSeller,
        metaTitle: body.metaTitle ?? null,
        metaDescription: body.metaDescription ?? null,
        needsDescription: !body.description,
      },
      select: { id: true, slug: true },
    });
  });

  await AuditService.log({
    actorId: actor.id, action: 'product.update', entityType: 'Product', entityId: id,
    changes: { before: { name: existing.name, status: existing.status, price: existing.price }, after: body },
    ip: clientIp(req.headers),
  });

  return NextResponse.json(updated);
});

/**
 * DELETE — removes a product from the store.
 *
 * Soft by default, so a historic order can still resolve what was bought and
 * a mis-click is recoverable from Products → Deleted. `?permanent=1` erases
 * the row outright, and is refused for anything a customer has ever ordered:
 * the order would be left pointing at nothing, and an order must always be
 * able to say what it was for.
 */
export const DELETE = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  const actor = await requirePermission('products.write');
  const { id } = await ctx.params;
  const permanent = req.nextUrl.searchParams.get('permanent') === '1';

  if (permanent) {
    const ordered = await prisma.orderItem.count({ where: { productId: id } });
    if (ordered > 0) {
      throw conflict(
        `This product appears in ${ordered} order${ordered === 1 ? '' : 's'}, so it cannot be erased. It stays deleted and hidden from the store.`,
      );
    }

    await prisma.product.delete({ where: { id } });
    await AuditService.log({
      actorId: actor.id, action: 'product.delete_permanent', entityType: 'Product',
      entityId: id, ip: clientIp(req.headers),
    });
    return NextResponse.json({ ok: true, permanent: true });
  }

  await prisma.product.update({
    where: { id },
    data: { deletedAt: new Date(), status: ProductStatus.ARCHIVED, publishedAt: null },
  });

  await AuditService.log({
    actorId: actor.id, action: 'product.archive', entityType: 'Product',
    entityId: id, ip: clientIp(req.headers),
  });

  return NextResponse.json({ ok: true });
});

/** POST — restores a deleted product, as a draft so it cannot silently reappear on the store. */
export const POST = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  const actor = await requirePermission('products.write');
  const { id } = await ctx.params;

  const restored = await prisma.product.update({
    where: { id },
    data: { deletedAt: null, status: ProductStatus.DRAFT, publishedAt: null },
    select: { id: true, slug: true },
  });

  await AuditService.log({
    actorId: actor.id, action: 'product.restore', entityType: 'Product',
    entityId: id, ip: clientIp(req.headers),
  });

  return NextResponse.json({ ok: true, product: restored });
});
