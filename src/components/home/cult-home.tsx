'use client';

import Image from 'next/image';
import Link from 'next/link';
import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import { formatPaise } from '@/lib/money';
import type { ProductCardDTO } from '@/types';

export interface CultHeroSlide {
  id: string;
  title: string;
  href: string;
  desktopImage: string | null;
  mobileImage: string | null;
  imageAlt: string;
  focalDesktop: string;
  focalMobile: string;
}

const collections = [
  { title: 'Polos', href: '/category/polos', image: '/images/cult/edit-polo.jpg', alt: 'Model in a black textured polo' },
  { title: 'Shirts', href: '/category/shirts', image: '/images/cult/edit-sunflower-shirt.jpg', alt: 'Model wearing a patterned shirt' },
  { title: 'T-Shirts', href: '/category/t-shirts', image: '/images/cult/edit-henley.jpg', alt: 'Model in a relaxed light top' },
];

type LookPosition = 'active' | 'left' | 'right' | 'far-left' | 'far-right';

function lookPosition(index: number, activeIndex: number, count: number): LookPosition {
  const offset = (index - activeIndex + count) % count;
  if (offset === 0) return 'active';
  if (offset === 1) return 'right';
  if (offset === count - 1) return 'left';
  if (offset === 2) return 'far-right';
  return 'far-left';
}

/** Image-led campaign layout, using CULT artwork and live catalogue records. */
export function CultHome({
  slides,
  bestSellers,
  trendingProducts,
}: {
  slides: CultHeroSlide[];
  bestSellers: ProductCardDTO[];
  trendingProducts: ProductCardDTO[];
}) {
  const campaign = slides.find((slide) =>
    slide.desktopImage?.includes('/cult/') || slide.desktopImage?.includes('/home/cult-'),
  );
  const heroDesktop = campaign?.desktopImage ?? '/images/home/cult-hero-desktop.jpg';
  const heroMobile = campaign?.mobileImage ?? '/images/home/cult-hero-mobile.jpg';
  const [lookIndex, setLookIndex] = React.useState(0);
  const [lookPaused, setLookPaused] = React.useState(false);
  const swipeStart = React.useRef<{ x: number; y: number } | null>(null);
  const suppressProductClick = React.useRef(false);

  React.useEffect(() => {
    if (trendingProducts.length < 2 || lookPaused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const interval = window.setInterval(() => {
      setLookIndex((current) => (current + 1) % trendingProducts.length);
    }, 2500);

    return () => window.clearInterval(interval);
  }, [lookPaused, trendingProducts.length]);

  React.useEffect(() => {
    setLookIndex((current) => current % Math.max(1, trendingProducts.length));
  }, [trendingProducts.length]);

  const startLookSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    swipeStart.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setLookPaused(true);
  };

  const finishLookSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    setLookPaused(event.pointerType === 'mouse');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!start || trendingProducts.length < 2) return;

    const horizontalDistance = event.clientX - start.x;
    const verticalDistance = event.clientY - start.y;
    if (Math.abs(horizontalDistance) < 45 || Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) return;

    suppressProductClick.current = true;
    setLookIndex((current) => (
      current + (horizontalDistance < 0 ? 1 : -1) + trendingProducts.length
    ) % trendingProducts.length);
    window.setTimeout(() => {
      suppressProductClick.current = false;
    }, 500);
  };

  const cancelLookSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    swipeStart.current = null;
    setLookPaused(event.pointerType === 'mouse');
  };

  return (
    <div className="cult-home bg-bg">
      <section className="cult-hero relative isolate overflow-hidden bg-sunken text-white" aria-labelledby="cult-hero-title">
        <Image src={heroMobile} alt="" fill priority sizes="100vw" className="object-cover md:hidden" style={{ objectPosition: campaign?.focalMobile ?? 'center center' }} />
        <Image src={heroDesktop} alt="" fill priority sizes="100vw" className="hidden object-cover md:block" style={{ objectPosition: campaign?.focalDesktop ?? 'center center' }} />
        <div className="cult-hero-shade absolute inset-0" aria-hidden />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.42em] text-white/85 md:text-xs">CULT / 001</p>
          <h1 id="cult-hero-title" className="font-sans text-[clamp(4.75rem,17vw,15rem)] font-bold leading-[0.78] tracking-[-0.09em]">CULT.</h1>
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.26em] text-white/90 md:mt-9 md:text-sm">Dress like you mean it</p>
        </div>
        <Link href="/shop" className="cult-outline-button absolute bottom-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap md:bottom-12">
          Explore collection <ArrowRight size={18} aria-hidden />
        </Link>
      </section>

      <section className="cult-collections" aria-label="Shop by category">
        {collections.map((collection) => (
          <Link key={collection.title} href={collection.href} className="cult-collection group relative isolate overflow-hidden bg-sunken text-white">
            <Image src={collection.image} alt={collection.alt} fill sizes="(max-width: 767px) 100vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" aria-hidden />
            <div className="absolute inset-x-5 bottom-7 z-10 md:inset-x-8 md:bottom-10">
              <h2 className="font-sans text-4xl font-black uppercase tracking-[-0.055em] md:text-[clamp(2.5rem,4vw,5rem)]">{collection.title}</h2>
              <span className="cult-outline-button mt-4 w-fit">Shop now <ArrowRight size={17} aria-hidden /></span>
            </div>
          </Link>
        ))}
      </section>

      <section className="cult-bestsellers border-y border-line bg-surface py-16 md:py-24" aria-labelledby="bestsellers-title">
          <div className="container mb-8 flex flex-col gap-5 md:mb-10 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.38em] text-muted">◢ &nbsp; Most wanted fits</p>
              <h2 id="bestsellers-title" className="font-sans text-[clamp(3.5rem,9vw,8rem)] font-black uppercase leading-[0.85] tracking-[-0.075em]">Bestsellers</h2>
              <p className="mt-5 text-sm uppercase tracking-[0.08em] text-muted md:text-base">Heavy rotation pieces</p>
            </div>
            <Link href="/shop?collection=best-sellers" className="inline-flex items-center gap-3 self-start pb-1 text-xs font-semibold uppercase tracking-[0.24em] transition-colors hover:text-gold md:self-end">
              Explore collection <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
          <div className="cult-product-rail no-scrollbar" role="region" aria-label="Bestselling products" tabIndex={0}>
            {bestSellers.length > 0 ? bestSellers.map((product) => {
              const photo = product.images.find((item) => !item.isPlaceholder) ?? product.image;
              return (
                <Link key={product.id} href={`/product/${product.slug}`} className="cult-product group relative isolate block overflow-hidden bg-sunken">
                  {photo ? <Image src={photo.url} alt={photo.alt || product.name} fill sizes="(max-width: 767px) 72vw, 29vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" /> : <span className="absolute inset-0 grid place-items-center text-xs uppercase tracking-widest text-muted">Image coming soon</span>}
                  <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pb-5 pt-20 text-white md:px-5">
                    <h3 className="truncate font-sans text-sm font-semibold uppercase tracking-[0.06em] md:text-base">{product.name}</h3>
                    <p className="mt-1 text-sm">{formatPaise(product.pricePaise)}</p>
                  </div>
                </Link>
              );
            }) : collections.map((collection) => (
              <Link key={collection.title} href={collection.href} className="cult-product group relative isolate block overflow-hidden bg-sunken">
                <Image src={collection.image} alt={collection.alt} fill sizes="(max-width: 767px) 72vw, 29vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 to-transparent px-4 pb-5 pt-20 text-white md:px-5">
                  <h3 className="font-sans text-base font-semibold uppercase tracking-[0.06em]">Shop {collection.title}</h3>
                </div>
              </Link>
            ))}
          </div>
      </section>

      {trendingProducts.length > 0 && (
        <section className="cult-looks overflow-hidden bg-bg py-16 md:py-24" aria-labelledby="looks-title">
          <div className="container text-center">
            <p className="mb-3 text-[11px] uppercase tracking-[0.38em] text-muted">The CULT edit</p>
            <h2 id="looks-title" className="font-sans text-[clamp(3.3rem,8vw,7.5rem)] font-black uppercase leading-[0.84] tracking-[-0.075em]">Trending<br />right now</h2>
            <p className="mx-auto mt-6 max-w-lg text-sm text-muted md:text-lg">Five standout pieces, selected in Admin.</p>
          </div>
          <div
            className="cult-look-stage relative mx-auto mt-12 max-w-[1380px] md:mt-16"
            onMouseEnter={() => setLookPaused(true)}
            onMouseLeave={() => setLookPaused(false)}
            onFocusCapture={() => setLookPaused(true)}
            onBlurCapture={() => setLookPaused(false)}
            onPointerDown={startLookSwipe}
            onPointerUp={finishLookSwipe}
            onPointerCancel={cancelLookSwipe}
            onDragStart={(event) => event.preventDefault()}
            onClickCapture={(event) => {
              if (!suppressProductClick.current) return;
              event.preventDefault();
              event.stopPropagation();
              suppressProductClick.current = false;
            }}
          >
            {trendingProducts.map((product, index) => {
              const position = lookPosition(index, lookIndex, trendingProducts.length);
              const photo = product.image ?? product.images[0];
              const hoverPhoto = product.hoverImage ?? product.images[1];
              return (
                <Link
                  key={product.id}
                  href={`/product/${product.slug}`}
                  data-position={position}
                  className="cult-look-card group absolute block overflow-hidden bg-sunken"
                  aria-hidden={position !== 'active'}
                  tabIndex={position === 'active' ? 0 : -1}
                >
                  {photo ? (
                    <Image src={photo.url} alt={photo.alt || product.name} fill sizes="(max-width: 767px) 72vw, 34vw" className="cult-look-image object-cover" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-xs uppercase tracking-widest text-muted">Image coming soon</span>
                  )}
                  {hoverPhoto && hoverPhoto.id !== photo?.id && (
                    <Image src={hoverPhoto.url} alt="" fill sizes="(max-width: 767px) 72vw, 34vw" className="cult-look-hover-image object-cover" aria-hidden />
                  )}
                  <div className="cult-look-copy absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/70 to-transparent px-5 pb-5 pt-24 text-white">
                    <h3 className="truncate font-sans text-sm font-semibold uppercase tracking-[0.09em] md:text-base">{product.name}</h3>
                    <div className="mt-2 flex items-center justify-between gap-4">
                      <span className="text-sm">{formatPaise(product.pricePaise)}</span>
                      <span className="cult-look-cta inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em]">View product <ArrowRight size={15} aria-hidden /></span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          {trendingProducts.length > 1 && (
            <div className="mt-8 flex justify-center gap-2" aria-label="Select a trending product">
              {trendingProducts.map((product, index) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setLookIndex(index)}
                  aria-label={`Show ${product.name}`}
                  aria-current={lookIndex === index}
                  className={`h-1.5 rounded-full transition-all ${lookIndex === index ? 'w-8 bg-ink' : 'w-1.5 bg-ink/35 hover:bg-ink/70'}`}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
