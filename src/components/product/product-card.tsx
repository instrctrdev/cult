'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Price } from '@/components/ui/price';
import type { ProductCardDTO } from '@/types';

/**
 * The storefront's core tile.
 *
 * The image area is a swipeable strip of every shot the product has —
 * mirroring the product page's own gallery — rather than just a hover swap
 * between two images. The whole card is one link with an overlay, so the tap
 * target is the full tile on mobile; the strip's own drag/swipe still works
 * over it, since a scroll gesture never fires the overlay's click. Saving to
 * the wishlist happens from the product page, not the grid tile.
 */
export function ProductCard({
  product,
  priority = false,
  className,
  sizes = '(min-width:1280px) 22vw, (min-width:768px) 30vw, 45vw',
}: {
  product: ProductCardDTO;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  const href = `/product/${product.slug}`;
  const usable = product.images.filter((i) => !i.isPlaceholder);
  const strip = usable.length > 0 ? usable : product.image ? [product.image] : [];

  const stripRef = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState(0);

  const onScroll = () => {
    const el = stripRef.current;
    if (!el) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  };

  const step = (dir: 1 | -1) => {
    const el = stripRef.current;
    if (!el) return;
    const next = Math.min(strip.length - 1, Math.max(0, active + dir));
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    setActive(next);
  };

  return (
    <article className={cn('group relative flex flex-col', className)}>
      {/* z-10 lifts the whole image area (and its scroll strip) above the
          title link's full-card `::after` overlay below — without it, that
          overlay paints on top (later in DOM order) and silently swallows
          every touch-drag before the strip ever sees it, since it has no
          scrollable content of its own to hand the gesture off to. */}
      <div className="relative z-10 overflow-hidden rounded-lg bg-surface">
        <Link href={href} className="block" tabIndex={-1} aria-hidden>
          {strip.length > 0 ? (
            <div
              ref={stripRef}
              onScroll={onScroll}
              className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
            >
              {strip.map((image, i) => (
                <div key={image.id} className="relative aspect-[3/4] w-full shrink-0 snap-center">
                  <Image
                    src={image.url}
                    alt={image.alt}
                    fill
                    sizes={sizes}
                    priority={priority && i === 0}
                    loading={priority && i === 0 ? undefined : 'lazy'}
                    placeholder={image.blurDataUrl ? 'blur' : 'empty'}
                    blurDataURL={image.blurDataUrl ?? undefined}
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                </div>
              ))}
            </div>
          ) : (
            // Honest placeholder — the admin still needs to upload artwork.
            <div className="grid aspect-[3/4] place-items-center bg-sunken">
              <span className="px-4 text-center font-display text-xs uppercase tracking-luxe text-faint">
                Image coming soon
              </span>
            </div>
          )}
        </Link>

        {strip.length > 1 && (
          <>
            {/* Desktop only — a swipe on mobile is discoverable enough on
                its own without an extra dot row taking up card space. */}
            <div className="pointer-events-none absolute inset-x-0 top-2 hidden justify-center gap-1 lg:flex">
              {strip.map((image, i) => (
                <span
                  key={image.id}
                  className={cn(
                    'h-1 w-1 rounded-full transition-colors',
                    i === active ? 'bg-bg' : 'bg-bg/40',
                  )}
                  aria-hidden
                />
              ))}
            </div>

            {/* Click-through on desktop hover; touch already has native swipe. */}
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={active === 0}
              aria-label="Previous image"
              className="absolute inset-y-0 left-0 z-10 hidden w-8 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-0 lg:flex"
            >
              <ChevronLeft className="h-4 w-4 rounded-full bg-bg/85 p-0.5 text-ink" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={active === strip.length - 1}
              aria-label="Next image"
              className="absolute inset-y-0 right-0 z-10 hidden w-8 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-0 lg:flex"
            >
              <ChevronRight className="h-4 w-4 rounded-full bg-bg/85 p-0.5 text-ink" aria-hidden />
            </button>
          </>
        )}

        {/* Badges — discount already appears beside the price below, so only
            the merchandising flags (best seller / new) show on the image. */}
        <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-end justify-start gap-1">
          {product.isBestSeller && (
            <span className="rounded-sm bg-bg/90 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink">
              Best seller
            </span>
          )}
          {!product.isBestSeller && product.isNewArrival && (
            <span className="rounded-sm bg-bg/90 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink">
              New
            </span>
          )}
        </div>

        {!product.inStock && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-bg/65">
            <span className="rounded-sm bg-ink/85 px-3 py-1.5 text-2xs font-semibold uppercase tracking-luxe text-bg">
              Sold out
            </span>
          </div>
        )}

      </div>

      <div className="mt-3 flex flex-col gap-1">
        <h3 className="text-sm leading-snug">
          <Link href={href} className="block truncate font-sans text-ink after:absolute after:inset-0 after:content-['']">
            {product.name}
          </Link>
        </h3>

        <Price pricePaise={product.pricePaise} compareAtPaise={product.compareAtPaise} size="sm" />
      </div>
    </article>
  );
}
