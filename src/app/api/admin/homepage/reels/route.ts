import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/session';
import { withErrorHandling, badRequest } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { adminHomepageReelSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (req: NextRequest) => {
  await requirePermission('banners.write');
  const body = adminHomepageReelSchema.parse(await req.json());
  const available = await prisma.product.count({
    where: { id: { in: body.productIds }, status: 'ACTIVE', deletedAt: null,
      publishedAt: { not: null, lte: new Date() } },
  });
  if (available !== 5) throw badRequest('Choose five published, active products.');
  const reel = await prisma.homepageReel.create({
    data: {
      title: body.title, videoUrl: body.videoUrl, posterUrl: body.posterUrl || null,
      position: body.position, isActive: body.isActive,
      products: { create: body.productIds.map((productId, position) => ({ productId, position })) },
    },
  });
  revalidatePath('/');
  return NextResponse.json(reel, { status: 201 });
});
