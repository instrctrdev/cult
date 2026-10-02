import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withErrorHandling, notFound, conflict } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { adminVariantSchema, cuidSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * PUT — replaces the product's variant set.
 *
 * Variants that disappear from the payload are deactivated rather than
 * deleted: an order item still points at them, and their inventory history
 * must survive.
 */
export const PUT = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  await requirePermission('products.write');
  const { id } = await ctx.params;

  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) throw notFound('Product not found.');

  const { variants } = z.object({ variants: z.array(adminVariantSchema).min(1).max(60) }).parse(await req.json());

  // A SKU must be unique across the whole catalogue, not just this product.
  const skus = variants.map((v) => v.sku.trim());
  if (new Set(skus).size !== skus.length) throw conflict('Each variant needs a distinct SKU.');

  const foreignSku = await prisma.productVariant.findFirst({
    where: { sku: { in: skus }, productId: { not: id } },
    select: { sku: true },
  });
  if (foreignSku) throw conflict(`SKU "${foreignSku.sku}" is already used by another product.`);

  await prisma.$transaction(async (tx) => {
    const keptIds: string[] = [];

    for (const [i, v] of variants.entries()) {
      const data = {
        sizeId: v.sizeId || null,
        colorId: v.colorId || null,
        sku: v.sku.trim(),
        price: new Prisma.Decimal(v.price),
        compareAtPrice: v.compareAtPrice ? new Prisma.Decimal(v.compareAtPrice) : null,
        weightGrams: v.weightGrams,
        isActive: v.isActive,
        position: i,
        deletedAt: null,
      };

      const saved = v.id
        ? await tx.productVariant.update({ where: { id: v.id }, data })
        : await tx.productVariant.create({ data: { ...data, productId: id } });

      keptIds.push(saved.id);

      await tx.inventory.upsert({
        where: { variantId: saved.id },
        create: { variantId: saved.id, quantity: v.quantity, lowStockThreshold: v.lowStockThreshold },
        // Stock is adjusted through the inventory screen (which writes a ledger
        // entry); saving a product must not silently overwrite it.
        update: { lowStockThreshold: v.lowStockThreshold },
      });
    }

    await tx.productVariant.updateMany({
      where: { productId: id, id: { notIn: keptIds } },
      data: { isActive: false, deletedAt: new Date() },
    });
  });

  const saved = await prisma.productVariant.findMany({
    where: { productId: id, deletedAt: null },
    orderBy: { position: 'asc' },
    include: { inventory: true, size: true, color: true },
  });

  return NextResponse.json({ variants: saved });
});

export const DELETE = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  await requirePermission('products.write');
  const { id } = await ctx.params;

  const { variantId } = z.object({ variantId: cuidSchema }).parse({
    variantId: req.nextUrl.searchParams.get('variantId'),
  });

  await prisma.productVariant.updateMany({
    where: { id: variantId, productId: id },
    data: { isActive: false, deletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
});
