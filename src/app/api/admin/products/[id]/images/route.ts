import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandling, notFound } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { MediaService } from '@/services/media.service';
import { cuidSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const addSchema = z.object({
  url: z.string().max(512),
  blurDataUrl: z.string().max(10_000).optional().nullable(),
  width: z.number().int().optional().nullable(),
  height: z.number().int().optional().nullable(),
  alt: z.string().max(255).optional().nullable(),
});

/** POST — attach an uploaded image to the product. */
export const POST = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  await requirePermission('products.write');
  const { id } = await ctx.params;

  const product = await prisma.product.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!product) throw notFound('Product not found.');

  const body = addSchema.parse(await req.json());
  const count = await prisma.productImage.count({ where: { productId: id } });

  const image = await prisma.productImage.create({
    data: {
      productId: id,
      url: body.url,
      blurDataUrl: body.blurDataUrl ?? null,
      width: body.width ?? null,
      height: body.height ?? null,
      alt: body.alt ?? product.name,
      position: count,
      isPlaceholder: false,
    },
  });

  // Clear any placeholder rows now that real artwork exists.
  await prisma.productImage.deleteMany({ where: { productId: id, isPlaceholder: true } });
  await prisma.product.update({ where: { id }, data: { needsImagery: false } });

  return NextResponse.json(image, { status: 201 });
});

/** PATCH — persist a new image order after drag-and-drop. */
export const PATCH = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  await requirePermission('products.write');
  const { id } = await ctx.params;

  const { order } = z.object({ order: z.array(cuidSchema).max(30) }).parse(await req.json());

  await prisma.$transaction(
    order.map((imageId, position) =>
      prisma.productImage.updateMany({ where: { id: imageId, productId: id }, data: { position } }),
    ),
  );

  return NextResponse.json({ ok: true });
});

/** DELETE — removes the row and the files it points at. */
export const DELETE = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  await requirePermission('products.write');
  const { id } = await ctx.params;

  const imageId = req.nextUrl.searchParams.get('imageId');
  if (!imageId) throw notFound('imageId is required.');

  const image = await prisma.productImage.findFirst({ where: { id: imageId, productId: id } });
  if (!image) throw notFound('Image not found.');

  await prisma.productImage.delete({ where: { id: imageId } });
  // Orphaned files would otherwise accumulate on the Hostinger disk.
  if (image.url) await MediaService.deleteImage(image.url).catch(() => undefined);

  return NextResponse.json({ ok: true });
});
