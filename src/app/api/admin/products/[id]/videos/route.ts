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
  posterUrl: z.string().max(512).optional().nullable(),
  alt: z.string().max(255).optional().nullable(),
});

/** POST — attach an uploaded clip to the product. */
export const POST = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  await requirePermission('products.write');
  const { id } = await ctx.params;

  const product = await prisma.product.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!product) throw notFound('Product not found.');

  const body = addSchema.parse(await req.json());
  const count = await prisma.productVideo.count({ where: { productId: id } });

  const video = await prisma.productVideo.create({
    data: {
      productId: id,
      url: body.url,
      posterUrl: body.posterUrl ?? null,
      alt: body.alt ?? product.name,
      position: count,
    },
  });

  return NextResponse.json(video, { status: 201 });
});

/** PATCH — persist a new order after the admin reorders them. */
export const PATCH = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  await requirePermission('products.write');
  const { id } = await ctx.params;

  const { order } = z.object({ order: z.array(cuidSchema).max(30) }).parse(await req.json());

  await prisma.$transaction(
    order.map((videoId, position) =>
      prisma.productVideo.updateMany({ where: { id: videoId, productId: id }, data: { position } }),
    ),
  );

  return NextResponse.json({ ok: true });
});

/** DELETE — removes the row and the file it points at. */
export const DELETE = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  await requirePermission('products.write');
  const { id } = await ctx.params;

  const videoId = req.nextUrl.searchParams.get('videoId');
  if (!videoId) throw notFound('videoId is required.');

  const video = await prisma.productVideo.findFirst({ where: { id: videoId, productId: id } });
  if (!video) throw notFound('Video not found.');

  await prisma.productVideo.delete({ where: { id: videoId } });
  // Orphaned files would otherwise accumulate on the Hostinger disk.
  await MediaService.deleteVideo(video.url).catch(() => undefined);

  return NextResponse.json({ ok: true });
});
