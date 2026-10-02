import { NextResponse, type NextRequest } from 'next/server';
import { MediaKind } from '@prisma/client';
import { z } from 'zod';
import { withErrorHandling, notFound } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { ReviewService } from '@/services/review.service';
import { cuidSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  productId: cuidSchema,
  authorName: z.string().trim().min(1).max(150),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(255).optional().nullable(),
  body: z.string().trim().max(4000).optional().nullable(),
  /** Optional, so a batch entered today does not all read as today's date. */
  createdAt: z.string().datetime().optional().nullable(),
  media: z
    .array(
      z.object({
        kind: z.nativeEnum(MediaKind),
        url: z.string().max(512),
        posterUrl: z.string().max(512).optional().nullable(),
      }),
    )
    .max(12)
    .optional(),
});

/**
 * POST /api/admin/reviews — records a review the store collected off-site.
 *
 * Reviews are not submitted through the storefront; staff enter what customers
 * sent them over WhatsApp or Instagram, along with the photos and clips that
 * came with it.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  await requirePermission('reviews.write');

  const body = createSchema.parse(await req.json());

  const product = await prisma.product.findUnique({ where: { id: body.productId }, select: { id: true } });
  if (!product) throw notFound('Product not found.');

  const review = await ReviewService.createCurated({
    productId: body.productId,
    authorName: body.authorName,
    rating: body.rating,
    title: body.title,
    body: body.body,
    createdAt: body.createdAt ? new Date(body.createdAt) : null,
    media: body.media,
  });

  return NextResponse.json(review, { status: 201 });
});
