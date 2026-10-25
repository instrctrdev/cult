import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/session';
import { withErrorHandling } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { adminHomepagePromoSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (req: NextRequest) => {
  await requirePermission('banners.write');
  const body = adminHomepagePromoSchema.parse(await req.json());
  const promo = await prisma.homepageCategoryPromo.create({
    data: {
      ...body, eyebrow: body.eyebrow || null, mobileImage: body.mobileImage || null,
      imageAlt: body.imageAlt || null,
    },
  });
  revalidatePath('/');
  return NextResponse.json(promo, { status: 201 });
});
