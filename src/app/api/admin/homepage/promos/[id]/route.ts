import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { requirePermission } from '@/lib/auth/session';
import { withErrorHandling, notFound } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { adminHomepagePromoSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  await requirePermission('banners.write');
  const { id } = await ctx.params;
  const body = adminHomepagePromoSchema.parse(await req.json());
  const existing = await prisma.homepageCategoryPromo.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound('Category feature not found.');
  const promo = await prisma.homepageCategoryPromo.update({
    where: { id }, data: {
      ...body, eyebrow: body.eyebrow || null, mobileImage: body.mobileImage || null,
      imageAlt: body.imageAlt || null,
    },
  });
  revalidatePath('/');
  return NextResponse.json(promo);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  await requirePermission('banners.write');
  const { id } = await ctx.params;
  const existing = await prisma.homepageCategoryPromo.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound('Category feature not found.');
  await prisma.homepageCategoryPromo.delete({ where: { id } });
  revalidatePath('/');
  return NextResponse.json({ ok: true });
});
