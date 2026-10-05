import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma, ProductStatus } from '@prisma/client';
import { withErrorHandling, conflict } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/audit.service';
import { adminProductSchema, adminVariantSchema } from '@/lib/validation';
import { slugify } from '@/lib/utils';
import { clientIp } from '@/lib/rate-limit';
import { generateNumericSku } from '@/lib/numeric-sku';

export const dynamic = 'force-dynamic';

const createSchema = adminProductSchema.extend({
  variants: z.array(adminVariantSchema.omit({ id: true })).max(60).default([]),
}).superRefine((body, ctx) => {
  if (body.status === 'ACTIVE' && !body.variants.some((variant) => variant.isActive)) {
    ctx.addIssue({ code: 'custom', path: ['variants'], message: 'Add an active variant before publishing.' });
  }
});

/** POST /api/admin/products — create the product and its starting variants together. */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const actor = await requirePermission('products.write');
  const body = createSchema.parse(await req.json());

  const slug = body.slug || slugify(body.name);
  const clash = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  if (clash) throw conflict('A product with that URL slug already exists.');

  const reservedSkus = new Set<string>();
  const resolvedVariants = [];
  for (const variant of body.variants) {
    const sku = variant.sku.trim() || await generateNumericSku(reservedSkus);
    reservedSkus.add(sku);
    resolvedVariants.push({ ...variant, sku });
  }
  const skus = resolvedVariants.map((variant) => variant.sku);
  if (new Set(skus).size !== skus.length) throw conflict('Each variant needs a distinct SKU.');
  if (skus.length) {
    const foreignSku = await prisma.productVariant.findFirst({
      where: { sku: { in: skus } }, select: { sku: true },
    });
    if (foreignSku) throw conflict(`SKU "${foreignSku.sku}" is already used by another product.`);
  }

  const product = await prisma.product.create({
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
      variants: {
        create: resolvedVariants.map((variant, position) => ({
          sizeId: variant.sizeId || null,
          colorId: variant.colorId || null,
          sku: variant.sku.trim(),
          price: new Prisma.Decimal(variant.price),
          compareAtPrice: variant.compareAtPrice ? new Prisma.Decimal(variant.compareAtPrice) : null,
          weightGrams: variant.weightGrams,
          isActive: variant.isActive,
          position,
          inventory: { create: { quantity: variant.quantity, lowStockThreshold: variant.lowStockThreshold } },
        })),
      },
    },
    select: { id: true, slug: true },
  });

  await AuditService.log({
    actorId: actor.id, action: 'product.create', entityType: 'Product',
    entityId: product.id, changes: { after: body }, ip: clientIp(req.headers),
  });

  return NextResponse.json(product, { status: 201 });
});
