'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductCard } from './product-card';
import { cn } from '@/lib/utils';
import type { ProductCardDTO } from '@/types';

/**
 * Horizontal product rail.
 *
 * On touch this is a native snap-scroll strip — no JS carousel, so it stays
 * smooth and adds no bundle weight. Desktop gets arrow buttons that scroll the
 * same container. Overflow is contained so the page itself never scrolls
 * sideways.
 */
export function ProductRail({
  title,
  products,
  viewAllHref,
  viewAllLabel = 'View all',
  eyebrow,
}: {
  title: string;
  products: ProductCardDTO[];
  viewAllHref?: string;
  viewAllLabel?: string;
  eyebrow?: string;
}) {
  const railRef = React.useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = React.useState(true);
  const [atEnd, setAtEnd] = React.useState(false);

  const sync = React.useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  React.useEffect(() => {
    sync();
    const el = railRef.current;
    if (!el) return;
    el.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    return () => {
      el.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [sync]);

  const scrollBy = (dir: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: 'smooth' });
  };

  if (!products.length) return null;

  /**
   * Heading and track share this exact gutter. Deriving one from `.container`
   * and the other from its own padding meant they drifted apart whenever the
   * container's breakpoints and the utility breakpoints disagreed.
   */
  const gutter = 'mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8';

  return (
    <section className="py-10 md:py-14">
      <div className={gutter}>
        <div className="mb-5 flex items-end justify-between gap-4 md:mb-7">
          <div>
            {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
            <h2 className="text-2xl md:text-3xl">{title}</h2>
          </div>

          <div className="flex items-center gap-2">
            {viewAllHref && (
              <Link
                href={viewAllHref}
                className="shrink-0 text-2xs font-medium uppercase tracking-wide2 text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                {viewAllLabel} →
              </Link>
            )}

            <div className="hidden items-center gap-1.5 lg:flex">
              <button
                type="button"
                onClick={() => scrollBy(-1)}
                disabled={atStart}
                aria-label="Scroll left"
                className="grid h-9 w-9 place-items-center rounded-full border border-ink/15 transition-colors hover:border-ink disabled:opacity-30 disabled:hover:border-ink/15"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => scrollBy(1)}
                disabled={atEnd}
                aria-label="Scroll right"
                className="grid h-9 w-9 place-items-center rounded-full border border-ink/15 transition-colors hover:border-ink disabled:opacity-30 disabled:hover:border-ink/15"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/*
        The rail shares the heading's gutter so cards line up with the title,
        and matches the container's max width so it cannot drift out of
        alignment on wide screens. `scroll-pl-*` mirrors the padding: without
        it, scroll-snap aligns the first card to the border box and silently
        scrolls the gutter away on load.
      */}
      <div
        ref={railRef}
        className={cn(
          'rail pb-1',
          gutter,
          // Mirrors the gutter: without it, scroll-snap aligns the first card
          // to the border box and silently scrolls the gutter away on load.
          'scroll-pl-4 sm:scroll-pl-6 lg:scroll-pl-8',
          'gap-3 md:gap-5',
        )}
        role="region"
        aria-label={title}
        tabIndex={0}
      >
        {products.map((product, i) => (
          <div key={product.id} className="w-[46vw] max-w-[280px] sm:w-[38vw] md:w-[30vw] lg:w-[23vw] xl:w-[19vw]">
            <ProductCard
              product={product}
              priority={i < 2}
              sizes="(min-width:1280px) 19vw, (min-width:768px) 30vw, 46vw"
            />
          </div>
        ))}
        <div className="w-1 shrink-0" aria-hidden />
      </div>
    </section>
  );
}
