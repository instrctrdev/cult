import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/session';
import { withErrorHandling, badRequest, notFound } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { adminHomepageReelSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  await requirePermission('banners.write');
  const { id } = await ctx.params;
  const body = adminHomepageReelSchema.parse(await req.json());
  const existing = await prisma.homepageReel.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound('Reel not found.');
  const available = await prisma.product.count({
    where: { id: { in: body.productIds }, status: 'ACTIVE', deletedAt: null,
      publishedAt: { not: null, lte: new Date() } },
  });
  if (available !== 5) throw badRequest('Choose five published, active products.');
  const reel = await prisma.homepageReel.update({
    where: { id },
    data: {
      title: body.title, videoUrl: body.videoUrl, posterUrl: body.posterUrl || null,
      position: body.position, isActive: body.isActive,
      products: {
        deleteMany: {},
        create: body.productIds.map((productId, position) => ({ productId, position })),
      },
    },
  });
  revalidatePath('/');
  return NextResponse.json(reel);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  await requirePermission('banners.write');
  const { id } = await ctx.params;
  const existing = await prisma.homepageReel.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound('Reel not found.');
  await prisma.homepageReel.delete({ where: { id } });
  revalidatePath('/');
  return NextResponse.json({ ok: true });
});
