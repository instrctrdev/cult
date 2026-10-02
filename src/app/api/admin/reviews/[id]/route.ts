import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandling } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** PATCH — approve or unapprove a customer review. Content is never edited here. */
export const PATCH = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  await requirePermission('reviews.write');
  const { id } = await ctx.params;

  const { isApproved } = z.object({ isApproved: z.boolean() }).parse(await req.json());
  const review = await prisma.review.update({ where: { id }, data: { isApproved } });

  return NextResponse.json(review);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  await requirePermission('reviews.write');
  const { id } = await ctx.params;

  await prisma.review.update({ where: { id }, data: { deletedAt: new Date(), isApproved: false } });
  return NextResponse.json({ ok: true });
});
