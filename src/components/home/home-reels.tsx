'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Play } from 'lucide-react';
import type { HomepageReelDTO } from '@/services/homepage.service';
import { formatPaise } from '@/lib/money';

function ReelCard({ reel, expanded, onToggle }: {
  reel: HomepageReelDTO;
  expanded: boolean;
  onToggle: () => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const frameRef = React.useRef<HTMLElement>(null);
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => {
    const frame = frameRef.current;
    const video = videoRef.current;
    if (!frame || !video) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !document.hidden) {
        void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      } else {
        video.pause();
        setPlaying(false);
      }
    }, { threshold: 0.45 });
    observer.observe(frame);
    return () => { observer.disconnect(); video.pause(); };
  }, []);

  return (
    <article ref={frameRef} className="cult-reel-card relative shrink-0 snap-start overflow-hidden bg-sunken">
      <video ref={videoRef} src={reel.videoUrl} poster={reel.posterUrl ?? undefined} muted loop playsInline preload="none" className="absolute inset-0 h-full w-full object-cover" aria-label={reel.title} />
      {!playing && <span className="pointer-events-none absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white"><Play size={14} fill="currentColor" aria-hidden /></span>}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" aria-hidden />
      <p className="absolute bottom-5 left-4 right-16 truncate text-xs font-semibold uppercase tracking-[0.14em] text-white">{reel.title}</p>
      <button type="button" onClick={onToggle} aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'Show'} five products in ${reel.title}`} className="cult-reel-bubble absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full bg-white px-2 py-1.5 text-black shadow-lg transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
        {reel.products[0]?.image && <Image src={reel.products[0].image.url} alt="" width={29} height={29} className="h-7 w-7 rounded-full object-cover" />}
        <span className="text-[11px] font-bold">{reel.products.length}</span>
        {expanded ? <ChevronDown size={15} aria-hidden /> : <ChevronUp size={15} aria-hidden />}
      </button>
      {expanded && (
        <div className="cult-reel-products absolute inset-x-3 bottom-16 z-10 max-h-[72%] overflow-y-auto rounded-2xl bg-white/95 p-2 text-black shadow-2xl backdrop-blur-md">
          {reel.products.map((product) => {
            const photo = product.image ?? product.images[0];
            return (
              <Link key={product.id} href={`/product/${product.slug}`} className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-black/10 focus-visible:bg-black/10">
                <span className="relative h-12 w-10 shrink-0 overflow-hidden rounded bg-neutral-200">
                  {photo && <Image src={photo.url} alt="" fill sizes="40px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{product.name}</span>
                  <span className="text-xs font-semibold">{formatPaise(product.pricePaise)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </article>
  );
}

export function HomeReels({ reels }: { reels: HomepageReelDTO[] }) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  if (!reels.length) return null;

  return (
    <section className="border-t border-line bg-surface py-16 md:py-24" aria-labelledby="cult-reels-heading">
      <div className="container mb-8 text-center">
        <p className="mb-3 text-[11px] uppercase tracking-[0.35em] text-muted">Seen on you</p>
        <h2 id="cult-reels-heading" className="font-sans text-3xl font-black uppercase tracking-[-0.05em] md:text-5xl">Styled &amp; loved</h2>
        <p className="mt-3 text-sm text-muted">Tap the product bubble to shop the five pieces in each reel.</p>
      </div>
      <div className="cult-reels-rail no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 md:gap-5 md:px-[max(2rem,calc((100vw-1440px)/2))]" role="region" aria-label="Shoppable reels" tabIndex={0}>
        {reels.map((reel) => <ReelCard key={reel.id} reel={reel} expanded={expandedId === reel.id} onToggle={() => setExpandedId((current) => current === reel.id ? null : reel.id)} />)}
      </div>
    </section>
  );
}
