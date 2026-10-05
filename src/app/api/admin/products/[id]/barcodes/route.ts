import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/session';
import { notFound, withErrorHandling } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { generateNumericSku } from '@/lib/numeric-sku';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** Replaces legacy text SKUs with scanner-friendly numeric barcodes in one transaction. */
export const POST = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  await requirePermission('products.write');
  const { id } = await ctx.params;
  const product = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    select: { variants: { where: { deletedAt: null }, select: { id: true, sku: true } } },
  });
  if (!product) throw notFound('Product not found.');

  const legacy = product.variants.filter((variant) => !/^\d{8,14}$/.test(variant.sku));
  const reserved = new Set(product.variants.map((variant) => variant.sku));
  const replacements: Array<{ id: string; sku: string }> = [];
  for (const variant of legacy) replacements.push({ id: variant.id, sku: await generateNumericSku(reserved) });

  if (replacements.length) {
    await prisma.$transaction(replacements.map((variant) => prisma.productVariant.update({
      where: { id: variant.id }, data: { sku: variant.sku },
    })));
  }
  return NextResponse.json({ updated: replacements.length });
});
