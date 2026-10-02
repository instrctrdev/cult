import { Star } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { ReviewService } from '@/services/review.service';
import { ReviewMedia, ReviewPhotoViewer, type ReviewMediaItem } from './review-photos';
import type { ZoomImage } from './image-zoom';

/**
 * Reviews.
 *
 * The store takes no reviews through the site — these are what customers sent
 * in, entered by staff with the photos and clips that came with them. Nothing
 * is seeded or generated: a product with no reviews says so.
 */
export async function ProductReviews({ productId }: { productId: string }) {
  const [reviews, summary] = await Promise.all([
    ReviewService.listForProduct(productId),
    ReviewService.summary(productId),
  ]);

  /**
   * One flat list of every photo on the page, so paging in the viewer runs
   * across all of them rather than stopping at the end of one review. Each
   * review's thumbnails carry the index they map to in that list.
   */
  const photos: ZoomImage[] = [];
  const mediaByReview = new Map<string, ReviewMediaItem[]>();

  for (const review of reviews) {
    mediaByReview.set(
      review.id,
      review.media.map((m) => {
        const isImage = m.kind === 'IMAGE';
        if (isImage) photos.push({ id: m.id, url: m.url, caption: `Photo from ${review.authorName}` });
        return {
          id: m.id,
          kind: m.kind,
          url: m.url,
          posterUrl: m.posterUrl,
          photoIndex: isImage ? photos.length - 1 : null,
        };
      }),
    );
  }

  return (
    <section className="py-12" aria-labelledby="reviews-title">
      <div className="container">
        <h2 id="reviews-title" className="mb-6 text-2xl">Reviews</h2>

        {!summary || reviews.length === 0 ? (
          <p className="rounded-lg bg-surface p-6 text-sm text-muted">
            No reviews yet. Reviews appear here once customers have shared their experience with us.
          </p>
        ) : (
          <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-12">
            <div className="mb-8 lg:mb-0">
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-4xl">{summary.average}</span>
                <span className="text-sm text-muted">out of 5</span>
              </div>
              <Stars rating={Math.round(summary.average)} className="mt-2" />
              <p className="mt-1.5 text-xs text-muted">
                Based on {summary.count} review{summary.count === 1 ? '' : 's'}
              </p>

              <ul className="mt-5 space-y-1.5">
                {summary.distribution.map((row) => (
                  <li key={row.star} className="flex items-center gap-2 text-xs">
                    <span className="w-8 text-muted">{row.star}★</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
                      <span
                        className="block h-full rounded-full bg-gold"
                        style={{ width: `${summary.count ? (row.count / summary.count) * 100 : 0}%` }}
                      />
                    </span>
                    <span className="w-6 text-right text-faint">{row.count}</span>
                  </li>
                ))}
              </ul>
            </div>

            <ReviewPhotoViewer photos={photos}>
              <ul className="divide-y divide-line">
                {reviews.map((review) => (
                  <li key={review.id} className="py-5 first:pt-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Stars rating={review.rating} />
                      <span className="text-sm font-medium text-ink">{review.authorName}</span>
                      {review.isVerified && (
                        <span className="rounded-full bg-success/10 px-2 py-0.5 text-2xs font-medium uppercase tracking-wide2 text-success">
                          Verified buyer
                        </span>
                      )}
                      <span className="text-xs text-faint">{formatDate(review.createdAt, 'long')}</span>
                    </div>
                    {review.title && <p className="mt-2 text-sm font-medium text-ink">{review.title}</p>}
                    {review.body && <p className="mt-1.5 text-sm leading-relaxed text-muted">{review.body}</p>}

                    <ReviewMedia media={mediaByReview.get(review.id) ?? []} authorName={review.authorName} />
                  </li>
                ))}
              </ul>
            </ReviewPhotoViewer>
          </div>
        )}
      </div>
    </section>
  );
}

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn('inline-flex gap-0.5', className)} role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn('h-3.5 w-3.5', i <= rating ? 'fill-gold-ink text-gold-ink' : 'text-ink/20')}
          aria-hidden
        />
      ))}
    </span>
  );
}
