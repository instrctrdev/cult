'use client';

import * as React from 'react';
import Image from 'next/image';
import { Play, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImageZoom } from './image-zoom';
import type { ProductImageDTO, ProductVideoDTO } from '@/types';

type Slide =
  | { kind: 'image'; key: string; image: ProductImageDTO; imageIndex: number }
  | { kind: 'video'; key: string; video: ProductVideoDTO };

/**
 * Product gallery.
 *
 * Mobile: a native snap-scroll strip with dot indicators — the swipe gesture
 * is the browser's own, so it is as smooth as a native app and costs no JS.
 * Desktop: thumbnail rail plus hover-to-zoom on the main image.
 *
 * Clips sit at the end of the same strip rather than in a block of their own,
 * so a shopper reaches them by continuing the swipe they were already making.
 * They are never autoplayed: an unasked-for video on a phone costs the shopper
 * their data, and `preload="metadata"` is enough to paint a first frame.
 */
export function ProductGallery({
  images,
  videos = [],
  productName,
}: {
  images: ProductImageDTO[];
  videos?: ProductVideoDTO[];
  productName: string;
}) {
  const [active, setActive] = React.useState(0);
  const [zoomAt, setZoomAt] = React.useState<number | null>(null);
  const [zooming, setZooming] = React.useState(false);
  const [origin, setOrigin] = React.useState({ x: 50, y: 50 });
  const stripRef = React.useRef<HTMLDivElement>(null);

  const usable = React.useMemo(() => images.filter((i) => !i.isPlaceholder), [images]);

  const slides = React.useMemo<Slide[]>(
    () => [
      ...usable.map((image, imageIndex): Slide => ({ kind: 'image', key: image.id, image, imageIndex })),
      ...videos.map((video): Slide => ({ kind: 'video', key: video.id, video })),
    ],
    [usable, videos],
  );

  if (slides.length === 0) {
    return (
      <div className="grid aspect-[3/4] place-items-center rounded-lg bg-sunken">
        <p className="px-6 text-center font-display text-xs uppercase tracking-luxe text-faint">
          Image coming soon
        </p>
      </div>
    );
  }

  // Track which slide is centred as the customer swipes.
  const onStripScroll = () => {
    const el = stripRef.current;
    if (!el) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  };

  const scrollToIndex = (index: number) => {
    stripRef.current?.scrollTo({ left: index * stripRef.current.clientWidth, behavior: 'smooth' });
    setActive(index);
  };

  const current = slides[Math.min(active, slides.length - 1)];

  return (
    <div className="lg:flex lg:gap-4">
      {zoomAt !== null && (
        <ImageZoom
          images={usable}
          productName={productName}
          startIndex={zoomAt}
          onClose={() => setZoomAt(null)}
        />
      )}

      {/* Desktop thumbnails */}
      {slides.length > 1 && (
        <div className="hidden shrink-0 lg:block">
          <ul className="flex w-20 flex-col gap-2.5" role="tablist" aria-label="Product media">
            {slides.map((slide, i) => (
              <li key={slide.key}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={active === i}
                  aria-label={
                    slide.kind === 'video'
                      ? `Play video ${i + 1} of ${slides.length}`
                      : `View image ${i + 1} of ${slides.length}`
                  }
                  onClick={() => setActive(i)}
                  // Hovering a clip must not swap the main pane out from under
                  // a video the shopper is already watching.
                  onMouseEnter={() => current.kind !== 'video' && setActive(i)}
                  className={cn(
                    'relative block aspect-[3/4] w-full overflow-hidden rounded-md bg-surface ring-1 transition-[box-shadow]',
                    active === i ? 'ring-2 ring-ink' : 'ring-line hover:ring-ink/40',
                  )}
                >
                  {slide.kind === 'image' ? (
                    <Image src={slide.image.url} alt="" fill sizes="80px" className="object-cover" />
                  ) : (
                    <>
                      {slide.video.posterUrl ? (
                        <Image src={slide.video.posterUrl} alt="" fill sizes="80px" className="object-cover" />
                      ) : (
                        <video
                          src={slide.video.url}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-cover"
                          aria-hidden
                        />
                      )}
                      <span className="absolute inset-0 grid place-items-center bg-ink/25" aria-hidden>
                        <Play className="h-4 w-4 fill-white text-white" />
                      </span>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mobile: swipeable strip */}
      <div className="lg:hidden">
        <div
          ref={stripRef}
          onScroll={onStripScroll}
          className="rail -mx-4 gap-0 px-0 sm:-mx-6"
          aria-label={`${productName} media`}
        >
          {slides.map((slide, i) =>
            slide.kind === 'image' ? (
              <button
                key={slide.key}
                type="button"
                onClick={() => setZoomAt(slide.imageIndex)}
                aria-label={`Open image ${i + 1} full screen`}
                className="relative aspect-[3/4] w-screen shrink-0 snap-center bg-surface"
              >
                <Image
                  src={slide.image.url}
                  alt={i === 0 ? productName : `${productName} — view ${i + 1}`}
                  fill
                  sizes="100vw"
                  priority={i === 0}
                  placeholder={slide.image.blurDataUrl ? 'blur' : 'empty'}
                  blurDataURL={slide.image.blurDataUrl ?? undefined}
                  className="object-cover"
                />
              </button>
            ) : (
              <div
                key={slide.key}
                className="relative aspect-[3/4] w-screen shrink-0 snap-center bg-ink"
              >
                <video
                  src={slide.video.url}
                  poster={slide.video.posterUrl ?? undefined}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={slide.video.alt}
                  className="h-full w-full object-contain"
                />
              </div>
            ),
          )}
        </div>

        {slides.length > 1 && (
          <div className="mt-3 flex justify-center gap-1.5" role="tablist" aria-label="Choose media">
            {slides.map((slide, i) => (
              <button
                key={slide.key}
                type="button"
                role="tab"
                aria-selected={active === i}
                aria-label={slide.kind === 'video' ? `Video ${i + 1}` : `Image ${i + 1}`}
                onClick={() => scrollToIndex(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  active === i ? 'w-5 bg-ink' : 'w-1.5 bg-ink/20',
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: main pane — hover zoom for stills, a player for clips */}
      <div className="hidden min-w-0 flex-1 lg:block">
        {current.kind === 'video' ? (
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-ink">
            <video
              // Keyed so switching clips loads the new source rather than
              // leaving the previous one paused mid-playback.
              key={current.video.id}
              src={current.video.url}
              poster={current.video.posterUrl ?? undefined}
              controls
              autoPlay
              playsInline
              preload="metadata"
              aria-label={current.video.alt}
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <div
            className="group relative aspect-[3/4] w-full cursor-zoom-in overflow-hidden rounded-lg bg-surface"
            onMouseEnter={() => setZooming(true)}
            onMouseLeave={() => setZooming(false)}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setOrigin({
                x: ((e.clientX - rect.left) / rect.width) * 100,
                y: ((e.clientY - rect.top) / rect.height) * 100,
              });
            }}
          >
            <Image
              src={current.image.url}
              alt={active === 0 ? productName : `${productName} — view ${active + 1}`}
              fill
              sizes="(min-width:1024px) 50vw, 100vw"
              priority
              placeholder={current.image.blurDataUrl ? 'blur' : 'empty'}
              blurDataURL={current.image.blurDataUrl ?? undefined}
              className="object-cover transition-transform duration-200 ease-out"
              style={{
                transform: zooming ? 'scale(2)' : 'scale(1)',
                transformOrigin: `${origin.x}% ${origin.y}%`,
              }}
            />
            <span
              className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-bg/85 px-2.5 py-1.5 text-2xs uppercase tracking-wide2 text-muted opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
              aria-hidden
            >
              <ZoomIn className="h-3 w-3" /> Hover to zoom
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
