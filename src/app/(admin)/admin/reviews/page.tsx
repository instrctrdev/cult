import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { ReviewModeration } from '@/components/admin/review-moderation';
import { ReviewComposer } from '@/components/admin/review-composer';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Reviews' };

export default async function AdminReviewsPage() {
  await requirePermission('reviews.read');

  const [reviews, products] = await Promise.all([
    prisma.review.findMany({
      where: { deletedAt: null },
      orderBy: [{ isApproved: 'asc' }, { createdAt: 'desc' }],
      take: 100,
      select: {
        id: true, authorName: true, rating: true, title: true, body: true,
        isVerified: true, isCurated: true, isApproved: true, createdAt: true,
        product: { select: { id: true, name: true } },
        media: { orderBy: { position: 'asc' }, select: { id: true, kind: true, url: true } },
      },
    }),
    prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl">Reviews</h1>
        <p className="mt-1 text-sm text-muted">
          Reviews are not submitted through the store. Enter what customers actually sent you — over
          WhatsApp, Instagram or in person — along with any photos or clips. Nothing here is generated.
        </p>
      </header>

      <ReviewComposer products={products} />

      <ReviewModeration
        reviews={reviews.map((r) => ({
          id: r.id,
          authorName: r.authorName,
          rating: r.rating,
          title: r.title,
          body: r.body,
          isVerified: r.isVerified,
          isCurated: r.isCurated,
          media: r.media.map((m) => ({ id: m.id, kind: m.kind, url: m.url })),
          isApproved: r.isApproved,
          createdAt: r.createdAt.toISOString(),
          productId: r.product.id,
          productName: r.product.name,
        }))}
      />
    </div>
  );
}
