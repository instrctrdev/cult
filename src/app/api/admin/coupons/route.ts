import { NextResponse, type NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withErrorHandling, conflict } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/audit.service';
import { adminCouponSchema } from '@/lib/validation';
import { clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (req: NextRequest) => {
  const actor = await requirePermission('coupons.write');
  const body = adminCouponSchema.parse(await req.json());

  const clash = await prisma.coupon.findUnique({ where: { code: body.code }, select: { id: true } });
  if (clash) throw conflict('That coupon code already exists.');

  const coupon = await prisma.coupon.create({
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
      products: { connect: body.productIds.map((id) => ({ id })) },
      categories: { connect: body.categoryIds.map((id) => ({ id })) },
    },
  });

  await AuditService.log({
    actorId: actor.id, action: 'coupon.create', entityType: 'Coupon',
    entityId: coupon.id, changes: { after: body }, ip: clientIp(req.headers),
  });

  return NextResponse.json(coupon, { status: 201 });
});
