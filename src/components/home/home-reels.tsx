'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ExternalLink, Play, Volume2, VolumeX, X } from 'lucide-react';
import { useCartActions } from '@/hooks/use-cart';
import { rupees } from '@/lib/analytics';
import type { HomepageReelDTO } from '@/services/homepage.service';
import { formatPaise } from '@/lib/money';
import type { ProductCardDTO, ProductDetailDTO } from '@/types';

function ReelCard({ reel, expanded, viewerOpen, onToggle, onOpen }: {
  reel: HomepageReelDTO;
  expanded: boolean;
  viewerOpen: boolean;
  onToggle: () => void;
  onOpen: (trigger: HTMLButtonElement) => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const frameRef = React.useRef<HTMLElement>(null);
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => {
    const frame = frameRef.current;
    const video = videoRef.current;
    if (!frame || !video) return;
    if (viewerOpen) {
      video.pause();
      setPlaying(false);
      return;
    }
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
  }, [viewerOpen]);

  return (
    <article ref={frameRef} className="cult-reel-card relative shrink-0 snap-start overflow-hidden bg-sunken">
      <video ref={videoRef} src={reel.videoUrl} poster={reel.posterUrl ?? undefined} muted loop playsInline preload="none" className="absolute inset-0 h-full w-full object-cover" aria-hidden />
      {!playing && <span className="pointer-events-none absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white"><Play size={14} fill="currentColor" aria-hidden /></span>}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" aria-hidden />
      <p className="pointer-events-none absolute bottom-5 left-4 right-16 truncate text-xs font-semibold uppercase tracking-[0.14em] text-white">{reel.title}</p>
      <button type="button" onClick={(event) => onOpen(event.currentTarget)} aria-label={`Play ${reel.title} and shop tagged products`} className="absolute inset-0 z-10 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white" />
      <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={`reel-products-${reel.id}`} aria-label={`${expanded ? 'Hide' : 'Show'} five products in ${reel.title}`} className="absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-white px-2 py-1.5 text-black shadow-lg transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
        {reel.products[0]?.image && <Image src={reel.products[0].image.url} alt="" width={29} height={29} className="h-7 w-7 rounded-full object-cover" />}
        <span className="text-[11px] font-bold">{reel.products.length}</span>
        {expanded ? <ChevronDown size={15} aria-hidden /> : <ChevronUp size={15} aria-hidden />}
      </button>
      {expanded && (
        <div id={`reel-products-${reel.id}`} className="cult-reel-products absolute inset-x-3 bottom-16 z-20 max-h-[72%] overflow-y-auto rounded-2xl bg-white/95 p-2 text-black shadow-2xl backdrop-blur-md">
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

function ReelProductCard({ product, onNavigate }: { product: ProductCardDTO; onNavigate: () => void }) {
  const { addItem } = useCartActions();
  const [showOptions, setShowOptions] = React.useState(false);
  const [variantId, setVariantId] = React.useState('');
  const selectRef = React.useRef<HTMLSelectElement>(null);
  const detail = useQuery<ProductDetailDTO>({
    queryKey: ['reel-product', product.slug],
    queryFn: async () => {
      const response = await fetch(`/api/products/${encodeURIComponent(product.slug)}`);
      if (!response.ok) throw new Error('Could not load product options.');
      return response.json() as Promise<ProductDetailDTO>;
    },
    staleTime: 60_000,
  });
  const variants = detail.data?.variants.filter((variant) => variant.inStock) ?? [];
  const chosen = variants.find((variant) => variant.id === variantId) ?? null;
  const photo = product.image ?? product.images[0];
  const shownPrice = chosen?.pricePaise ?? (variants.length === 1 ? variants[0].pricePaise : product.pricePaise);

  const addToCart = () => {
    if (detail.isError) {
      void detail.refetch();
      return;
    }
    if (!detail.data || variants.length === 0) return;
    if (variants.length > 1 && !showOptions) {
      setShowOptions(true);
      window.setTimeout(() => selectRef.current?.focus(), 0);
      return;
    }
    const variant = variants.length === 1 ? variants[0] : chosen;
    if (!variant) {
      selectRef.current?.focus();
      return;
    }
    addItem.mutate({
      variantId: variant.id,
      meta: {
        id: product.id,
        name: product.name,
        price: rupees(variant.pricePaise),
        variant: [variant.size?.label, variant.color?.name].filter(Boolean).join(' / '),
      },
    });
  };

  const buttonLabel = !product.inStock || (detail.data && variants.length === 0)
    ? 'Sold out'
    : detail.isPending ? 'Loading…'
      : detail.isError ? 'Retry'
        : addItem.isPending ? 'Adding…'
          : showOptions && !chosen ? 'Choose option'
            : 'Add to cart';

  return (
    <article className="flex w-[min(72vw,280px)] shrink-0 snap-center flex-col rounded-2xl bg-white p-3 text-black shadow-xl md:w-[300px] md:p-4">
      <div className="flex min-w-0 items-start gap-3">
        <Link href={`/product/${product.slug}`} onClick={onNavigate} className="relative h-16 w-14 shrink-0 overflow-hidden rounded-md bg-neutral-100" aria-label={`View ${product.name}`}>
          {photo && <Image src={photo.url} alt="" fill sizes="56px" className="object-cover" />}
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/product/${product.slug}`} onClick={onNavigate} className="line-clamp-2 text-xs font-semibold leading-snug hover:underline md:text-sm">{product.name}</Link>
          <p className="mt-1 text-xs font-semibold">{formatPaise(shownPrice)}</p>
        </div>
        <Link href={`/product/${product.slug}`} onClick={onNavigate} aria-label={`View ${product.name} details`} className="rounded p-1 hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"><ExternalLink size={16} aria-hidden /></Link>
      </div>
      {showOptions && variants.length > 1 && (
        <label className="mt-3 block text-[11px] font-medium">
          Size / colour
          <select ref={selectRef} value={variantId} onChange={(event) => setVariantId(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-black/25 bg-white px-2 text-xs text-black focus:border-black focus:outline-none">
            <option value="">Select an option</option>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {[variant.size?.label, variant.color?.name].filter(Boolean).join(' / ') || variant.sku}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="button" onClick={addToCart} disabled={!product.inStock || detail.isPending || addItem.isPending || (Boolean(detail.data) && variants.length === 0)} className="mt-3 min-h-11 w-full rounded-lg bg-neutral-900 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50">
        {buttonLabel}
      </button>
    </article>
  );
}

function ReelViewer({ reel, reelIndex, reelCount, onStep, onClose, triggerRef }: {
  reel: HomepageReelDTO;
  reelIndex: number;
  reelCount: number;
  onStep: (direction: -1 | 1) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const touchStart = React.useRef<{ x: number; y: number } | null>(null);
  const wheelGesture = React.useRef({ delta: 0, lastEvent: 0, lastNavigation: 0 });
  const [muted, setMuted] = React.useState(true);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play().catch(() => {});
    return () => video.pause();
  }, [reel.id]);

  const toggleSound = () => {
    const next = !muted;
    if (videoRef.current) {
      videoRef.current.muted = next;
      void videoRef.current.play().catch(() => {});
    }
    setMuted(next);
  };

  const canStep = (direction: -1 | 1) => reelIndex + direction >= 0 && reelIndex + direction < reelCount;
  const isInteractive = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest('button, a, input, select, textarea, [role="region"]'));

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStart.current = null;
    if (isInteractive(event.target)) return;
    const touch = event.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaY) < 60 || Math.abs(deltaY) < Math.abs(deltaX) * 1.2) return;
    const direction = deltaY < 0 ? 1 : -1;
    if (canStep(direction)) onStep(direction);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (isInteractive(event.target) || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    const now = Date.now();
    const gesture = wheelGesture.current;
    if (now - gesture.lastEvent > 250) gesture.delta = 0;
    gesture.lastEvent = now;
    gesture.delta += event.deltaY;
    if (Math.abs(gesture.delta) < 70 || now - gesture.lastNavigation < 900) return;
    const direction = gesture.delta > 0 ? 1 : -1;
    gesture.delta = 0;
    if (!canStep(direction)) return;
    gesture.lastNavigation = now;
    onStep(direction);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('input, select, textarea, [role="region"]')) return;
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    if (canStep(direction)) {
      event.preventDefault();
      onStep(direction);
    }
  };

  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[100] bg-black" />
      <Dialog.Content onCloseAutoFocus={(event) => { event.preventDefault(); triggerRef.current?.focus(); }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchCancel={() => { touchStart.current = null; }} onWheel={handleWheel} onKeyDown={handleKeyDown} className="fixed inset-0 z-[101] overflow-hidden bg-black text-white focus:outline-none">
        <Dialog.Title className="sr-only">{reel.title}</Dialog.Title>
        <Dialog.Description className="sr-only">Swipe up or down to switch reels and shop their tagged products.</Dialog.Description>
        <video key={reel.id} ref={videoRef} src={reel.videoUrl} poster={reel.posterUrl ?? undefined} autoPlay muted={muted} loop playsInline preload="metadata" className="absolute inset-0 h-full w-full touch-none object-cover md:object-contain" aria-label={reel.title} />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-36 bg-gradient-to-b from-black/65 to-transparent" aria-hidden />
        <p className="pointer-events-none absolute left-4 top-[max(1.5rem,env(safe-area-inset-top))] z-20 text-[11px] font-semibold uppercase tracking-[0.16em] text-white md:left-8 md:top-8" aria-live="polite">{reelIndex + 1} / {reelCount} {reelCount > 1 && <span className="block text-[9px] text-white/70 md:ml-2 md:inline md:text-[11px]">Swipe up or down</span>}</p>
        <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-30 flex gap-2 md:right-8 md:top-8">
          <button type="button" onClick={toggleSound} aria-label={muted ? 'Turn sound on' : 'Mute video'} className="grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            {muted ? <VolumeX size={21} aria-hidden /> : <Volume2 size={21} aria-hidden />}
          </button>
          <Dialog.Close aria-label="Close reel" className="grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><X size={23} aria-hidden /></Dialog.Close>
        </div>
        {reelCount > 1 && <div className="absolute right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 md:flex md:right-8">
          <button type="button" onClick={() => onStep(-1)} disabled={!canStep(-1)} aria-label="Previous reel" className="grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><ChevronUp size={24} aria-hidden /></button>
          <button type="button" onClick={() => onStep(1)} disabled={!canStep(1)} aria-label="Next reel" className="grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><ChevronDown size={24} aria-hidden /></button>
        </div>}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-72 bg-gradient-to-t from-black/90 via-black/45 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 z-20 pb-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <p className="mb-3 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-white md:px-8">Shop this reel · {reel.products.length} products</p>
          <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1 md:gap-4 md:px-8" role="region" aria-label={`Tagged products in ${reel.title}`} tabIndex={0}>
            {reel.products.map((product) => <ReelProductCard key={product.id} product={product} onNavigate={onClose} />)}
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

export function HomeReels({ reels }: { reels: HomepageReelDTO[] }) {
  const [activeReel, setActiveReel] = React.useState<HomepageReelDTO | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  if (!reels.length) return null;

  const openReel = (reel: HomepageReelDTO, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setExpandedId(null);
    setActiveReel(reel);
  };

  const stepReel = (direction: -1 | 1) => {
    setActiveReel((current) => {
      if (!current) return null;
      const index = reels.findIndex((item) => item.id === current.id);
      return index < 0 ? current : reels[index + direction] ?? current;
    });
  };

  return (
    <section className="border-t border-line bg-surface py-16 md:py-24" aria-labelledby="cult-reels-heading">
      <div className="container mb-8 text-center">
        <p className="mb-3 text-[11px] uppercase tracking-[0.35em] text-muted">Seen on you</p>
        <h2 id="cult-reels-heading" className="font-sans text-3xl font-black uppercase tracking-[-0.05em] md:text-5xl">Shop From Reels</h2>
        <p className="mt-3 text-sm text-muted">Tap the product bubble to preview five pieces, or open a reel and swipe up or down to keep shopping.</p>
      </div>
      <div className="cult-reels-rail no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 md:gap-5 md:px-[max(2rem,calc((100vw-1440px)/2))]" role="region" aria-label="Shoppable reels" tabIndex={0}>
        {reels.map((reel) => <ReelCard key={reel.id} reel={reel} expanded={expandedId === reel.id} viewerOpen={activeReel !== null} onToggle={() => setExpandedId((current) => current === reel.id ? null : reel.id)} onOpen={(trigger) => openReel(reel, trigger)} />)}
      </div>
      <Dialog.Root open={activeReel !== null} onOpenChange={(open) => { if (!open) setActiveReel(null); }}>
        {activeReel && <ReelViewer reel={activeReel} reelIndex={reels.findIndex((item) => item.id === activeReel.id)} reelCount={reels.length} onStep={stepReel} onClose={() => setActiveReel(null)} triggerRef={triggerRef} />}
      </Dialog.Root>
    </section>
  );
}
