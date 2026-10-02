import 'server-only';
import { MediaKind } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface CuratedReviewMedia {
  kind: MediaKind;
  url: string;
  posterUrl?: string | null;
}

/**
 * Reviews.
 *
 * The store does not take reviews through the site. What customers send —
 * a WhatsApp message, an Instagram story, a photo of the parcel — is entered
 * here by staff instead, which is why every review carries `isCurated` and why
 * `isVerified` is not something this service will ever set from an admin
 * form. That badge is a factual claim about a delivered order, so it is only
 * ever derived from one.
 */
export const ReviewService = {
  async listForProduct(productId: string, limit = 20) {
    return prisma.review.findMany({
      where: { productId, isApproved: true, deletedAt: null },
      orderBy: [{ isVerified: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true, authorName: true, rating: true, title: true,
        body: true, isVerified: true, isCurated: true, createdAt: true,
        media: {
          orderBy: { position: 'asc' },
          select: { id: true, kind: true, url: true, posterUrl: true },
        },
      },
    });
  },

  async summary(productId: string) {
    const rows = await prisma.review.groupBy({
      by: ['rating'],
      where: { productId, isApproved: true, deletedAt: null },
      _count: { rating: true },
    });
    const count = rows.reduce((a, r) => a + r._count.rating, 0);
    if (!count) return null;
    const total = rows.reduce((a, r) => a + r.rating * r._count.rating, 0);
    return {
      average: Math.round((total / count) * 10) / 10,
      count,
      distribution: [5, 4, 3, 2, 1].map((star) => ({
        star,
        count: rows.find((r) => r.rating === star)?._count.rating ?? 0,
      })),
    };
  },

  /**
   * Records a review the store collected off-site, with any photos or clips
   * the customer sent along with it.
   *
   * Published straight away: staff are entering something they already have
   * in hand, so a second approval step would only be a queue of their own
   * work. `isVerified` is deliberately not settable here — see above.
   */
  async createCurated(input: {
    productId: string;
    authorName: string;
    rating: number;
    title?: string | null;
    body?: string | null;
    createdAt?: Date | null;
    media?: CuratedReviewMedia[];
  }) {
    return prisma.review.create({
      data: {
        productId: input.productId,
        authorName: input.authorName.slice(0, 150),
        rating: Math.min(5, Math.max(1, Math.round(input.rating))),
        title: input.title?.slice(0, 255) || null,
        body: input.body?.slice(0, 4000) || null,
        isVerified: false,
        isCurated: true,
        isApproved: true,
        // Backdating matters: a shoot's worth of reviews entered in one
        // sitting would otherwise all carry today's date.
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
        media: input.media?.length
          ? {
              create: input.media.slice(0, 12).map((m, position) => ({
                kind: m.kind,
                url: m.url.slice(0, 512),
                posterUrl: m.posterUrl?.slice(0, 512) || null,
                position,
              })),
            }
          : undefined,
      },
      include: { media: true },
    });
  },
};
