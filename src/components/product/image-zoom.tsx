'use client';

import * as React from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
/** How far a drag has to travel before it counts as a swipe rather than a tap. */
const SWIPE_COMMIT_RATIO = 0.18;
/** Movement that settles the question of whether this is a swipe or a pan. */
const AXIS_LOCK_PX = 8;
/** Resistance past the first and last image, so the end of the set is felt. */
const RUBBER_BAND = 0.3;

interface Transform {
  scale: number;
  x: number;
  y: number;
}

const IDENTITY: Transform = { scale: 1, x: 0, y: 0 };

/**
 * Full-screen product image with pinch-to-zoom.
 *
 * The page itself is deliberately not zoomable — browser zoom on a storefront
 * leaves the header and bag floating at the wrong size and is hard to undo on
 * a phone. Zoom belongs to the photograph, so it is implemented here: the
 * surface takes `touch-action: none` and handles the gestures itself, which
 * keeps the rest of the page pinned exactly where it was.
 *
 * Gestures: pinch to scale about the midpoint of the fingers, drag to pan once
 * zoomed in, double-tap to toggle. Panning is bounded so the image cannot be
 * flung off-screen and lost.
 */
export interface ZoomImage {
  id: string;
  url: string;
  /** Shown under the photograph. Used for customer photos, to say whose it is. */
  caption?: string | null;
}

export function ImageZoom({
  images,
  productName,
  label,
  startIndex,
  onClose,
}: {
  images: ZoomImage[];
  /** Captions product shots by position, when an image carries no caption. */
  productName: string;
  /** Names the set for screen readers. Defaults to the product's images. */
  label?: string;
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = React.useState(startIndex);
  const [t, setT] = React.useState<Transform>(IDENTITY);
  /** Live horizontal offset of an in-progress swipe. */
  const [dragX, setDragX] = React.useState(0);
  const surfaceRef = React.useRef<HTMLDivElement>(null);

  // Live pointers, so a pinch can be told from a drag.
  const pointers = React.useRef(new Map<number, { x: number; y: number }>());
  const gesture = React.useRef<{ dist: number; scale: number; midX: number; midY: number } | null>(null);
  const lastTap = React.useRef(0);
  /**
   * An unzoomed one-finger drag. `axis` is locked on the first few pixels of
   * movement and never revisited, so a swipe that drifts vertically does not
   * turn into something else halfway through.
   */
  const swipe = React.useRef<{ x: number; y: number; axis: 'none' | 'x' | 'y' } | null>(null);

  const zoomed = t.scale > 1.01;

  // Escape closes, arrows move — a zoom that traps the customer is worse than none.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    // The page behind must not scroll under the viewer.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Keeps the image overlapping its frame, so it can never be panned out of sight. */
  function clamp(next: Transform): Transform {
    const el = surfaceRef.current;
    if (!el) return next;
    const { width, height } = el.getBoundingClientRect();
    const maxX = Math.max(0, (width * (next.scale - 1)) / 2);
    const maxY = Math.max(0, (height * (next.scale - 1)) / 2);
    return {
      scale: next.scale,
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }

  function step(direction: number) {
    setDragX(0);
    setIndex((i) => {
      const next = i + direction;
      if (next < 0 || next >= images.length) return i;
      setT(IDENTITY); // a new photograph starts unzoomed
      return next;
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    // Register first: capture throws for a pointer the element does not own,
    // and losing the registration would leave the gesture never starting.
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // Capture is an optimisation; the gesture works without it.
    }

    if (pointers.current.size === 2) {
      // A second finger turns whatever was starting into a pinch, so any
      // half-committed swipe is abandoned rather than left to fire on release.
      swipe.current = null;
      setDragX(0);

      const [a, b] = [...pointers.current.values()];
      const rect = surfaceRef.current?.getBoundingClientRect();
      // The midpoint is stored relative to the element's centre, because that
      // is where the transform scales from. Using page coordinates instead
      // anchors the zoom to the wrong point and throws the image into a
      // corner on a pinch at the middle of the screen.
      gesture.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        scale: t.scale,
        midX: (a.x + b.x) / 2 - (rect ? rect.left + rect.width / 2 : 0),
        midY: (a.y + b.y) / 2 - (rect ? rect.top + rect.height / 2 : 0),
      };
      return;
    }

    // One finger on an unzoomed image is a swipe until it proves otherwise.
    if (pointers.current.size === 1 && !zoomed) {
      swipe.current = { x: e.clientX, y: e.clientY, axis: 'none' };
    }

    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      setT(zoomed ? IDENTITY : clamp({ ...IDENTITY, scale: DOUBLE_TAP_SCALE }));
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two fingers: scale about the point between them, so the image grows
    // from where the customer is looking rather than the centre.
    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const start = gesture.current;
      const scale = Math.min(MAX_SCALE, Math.max(1, (start.scale * dist) / start.dist));
      setT((cur) => {
        // Ratio against the live value, not the one captured when this
        // handler was created — mid-gesture those differ every frame.
        const ratio = scale / cur.scale;
        return clamp({
          scale,
          x: start.midX - (start.midX - cur.x) * ratio,
          y: start.midY - (start.midY - cur.y) * ratio,
        });
      });
      return;
    }

    // Zoomed in, one finger pans the photograph.
    if (pointers.current.size === 1 && zoomed) {
      setT((cur) => clamp({ ...cur, x: cur.x + (e.clientX - prev.x), y: cur.y + (e.clientY - prev.y) }));
      return;
    }

    // Zoomed out, it moves between photographs.
    if (pointers.current.size === 1 && swipe.current) {
      const dx = e.clientX - swipe.current.x;
      const dy = e.clientY - swipe.current.y;

      if (swipe.current.axis === 'none') {
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
        swipe.current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        // Movement this large is a drag, not the second half of a double-tap.
        lastTap.current = 0;
      }
      if (swipe.current.axis !== 'x') return;

      // Past the ends there is nothing to move to, so the image resists
      // rather than sliding away from a photograph that does not exist.
      const atEnd = (dx > 0 && index === 0) || (dx < 0 && index === images.length - 1);
      setDragX(atEnd ? dx * RUBBER_BAND : dx);
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);

    // A swipe that travelled far enough changes photograph; anything shorter
    // springs back, so a hesitant drag is never a commitment.
    if (swipe.current?.axis === 'x') {
      const width = surfaceRef.current?.getBoundingClientRect().width ?? 0;
      const travelled = Math.abs(dragX);
      if (width > 0 && travelled > width * SWIPE_COMMIT_RATIO) step(dragX < 0 ? 1 : -1);
      else setDragX(0);
    }
    if (pointers.current.size === 0) swipe.current = null;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      // Nothing to release.
    }
    if (pointers.current.size < 2) gesture.current = null;
    // A pinch that ends near 1× settles back cleanly rather than a hair off.
    if (pointers.current.size === 0 && t.scale < 1.05) setT(IDENTITY);
  }

  const image = images[index];
  const caption = image.caption ?? null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-ink" role="dialog" aria-modal="true" aria-label={label ?? `${productName} images`}>
      <div className="safe-top flex items-center justify-between px-4 py-3">
        <p className="text-xs text-white/70 tabular-nums">
          {index + 1} / {images.length}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-10 w-10 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        ref={surfaceRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // The browser must not claim these gestures, or the page pans instead.
        style={{ touchAction: 'none' }}
        className="relative flex-1 overflow-hidden"
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `translate3d(${t.x + dragX}px, ${t.y}px, 0) scale(${t.scale})`,
            // Untransitioned mid-gesture, or the image lags the fingers.
            transition: pointers.current.size === 0 ? 'transform 200ms ease-out' : 'none',
          }}
        >
          <Image
            key={image.id}
            src={image.url}
            alt={caption ?? `${productName} — view ${index + 1}`}
            fill
            sizes="100vw"
            priority
            className="select-none object-contain"
            draggable={false}
          />
        </div>
      </div>

      {caption && !zoomed && (
        <p className="px-6 pt-3 text-center text-xs text-white/70 text-pretty">{caption}</p>
      )}

      {images.length > 1 && !zoomed && (
        <div className="safe-bottom flex items-center justify-center gap-6 px-4 py-4">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={index === 0}
            aria-label="Previous image"
            className="grid h-11 w-11 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Past a handful the dots stop being readable, and the header
              already carries a counter. */}
          {images.length <= 8 ? (
            <div className="flex gap-1.5">
              {images.map((img, i) => (
                <span
                  key={img.id}
                  className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/30')}
                />
              ))}
            </div>
          ) : (
            <span className="text-xs tabular-nums text-white/60">
              {index + 1} / {images.length}
            </span>
          )}

          <button
            type="button"
            onClick={() => step(1)}
            disabled={index === images.length - 1}
            aria-label="Next image"
            className="grid h-11 w-11 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {!zoomed && (
        <p className="pb-3 text-center text-2xs uppercase tracking-wide2 text-white/40">
          {images.length > 1 ? 'Swipe to browse · pinch or double-tap to zoom' : 'Pinch or double-tap to zoom'}
        </p>
      )}
    </div>
  );
}
