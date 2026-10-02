import { NextResponse, type NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withErrorHandling, notFound } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { adminCouponSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  await requirePermission('coupons.write');
  const { id } = await ctx.params;

  const existing = await prisma.coupon.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound('Coupon not found.');

  const body = adminCouponSchema.parse(await req.json());

  const coupon = await prisma.coupon.update({
    where: { id },
    data: {
      code: body.code,
      description: body.description ?? null,
      type: body.type,
      value: new Prisma.Decimal(body.value),
      minOrderAmount: body.minOrderAmount ? new Prisma.Decimal(body.minOrderAmount) : null,
      maxDiscount: body.maxDiscount ? new Prisma.Decimal(body.maxDiscount) : null,
      usageLimit: body.usageLimit ?? null,
      perUserLimit: body.perUserLimit ?? null,
      startsAt: body.startsAt ?? null,
      expiresAt: body.expiresAt ?? null,
      isActive: body.isActive,
      appliesToSubset: body.appliesToSubset,
      freeShipping: body.freeShipping,
      firstOrderOnly: body.firstOrderOnly,
      // `set` replaces the relation so de-selections actually apply.
      products: { set: body.productIds.map((pid) => ({ id: pid })) },
      categories: { set: body.categoryIds.map((cid) => ({ id: cid })) },
    },
  });

  return NextResponse.json(coupon);
});

/** DELETE — soft delete; CouponUsage rows stay intact for reporting. */
export const DELETE = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  await requirePermission('coupons.write');
  const { id } = await ctx.params;

  await prisma.coupon.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  return NextResponse.json({ ok: true });
});
