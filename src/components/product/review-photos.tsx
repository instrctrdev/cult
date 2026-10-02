'use client';

import * as React from 'react';
import Image from 'next/image';
import { Expand } from 'lucide-react';
import { ImageZoom, type ZoomImage } from './image-zoom';

/**
 * Customer photos attached to reviews.
 *
 * The viewer is shared across the whole review list rather than owned by one
 * review, so next/previous walks every photo on the page instead of stopping
 * at the end of whichever review was tapped. Each one is captioned with whose
 * it is, which is the only thing that keeps a merged set legible.
 *
 * Videos are not part of this: they already play in place, and putting a
 * `<video>` behind a pinch-to-zoom surface takes its own controls away.
 */
const ViewerContext = React.createContext<((index: number) => void) | null>(null);

export function ReviewPhotoViewer({ photos, children }: { photos: ZoomImage[]; children: React.ReactNode }) {
  const [openAt, setOpenAt] = React.useState<number | null>(null);

  return (
    <ViewerContext.Provider value={setOpenAt}>
      {children}
      {openAt !== null && photos.length > 0 && (
        <ImageZoom
          images={photos}
          productName="Customer photo"
          label="Customer photos"
          startIndex={Math.min(openAt, photos.length - 1)}
          onClose={() => setOpenAt(null)}
        />
      )}
    </ViewerContext.Provider>
  );
}

export interface ReviewMediaItem {
  id: string;
  kind: 'IMAGE' | 'VIDEO';
  url: string;
  posterUrl: string | null;
  /** Position of this photo in the page-wide list; null for videos. */
  photoIndex: number | null;
}

export function ReviewMedia({ media, authorName }: { media: ReviewMediaItem[]; authorName: string }) {
  const open = React.useContext(ViewerContext);
  if (media.length === 0) return null;

  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {media.map((m) =>
        m.kind === 'IMAGE' ? (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => m.photoIndex !== null && open?.(m.photoIndex)}
              aria-label={`Open photo from ${authorName} full screen`}
              className="group relative block h-24 w-24 overflow-hidden rounded-md bg-surface"
            >
              <Image
                src={m.url}
                alt={`Photo from ${authorName}`}
                fill
                sizes="96px"
                className="object-cover transition-transform duration-200 group-hover:scale-105"
              />
              <span
                className="absolute inset-0 grid place-items-center bg-ink/0 text-white opacity-0 transition-all group-hover:bg-ink/30 group-hover:opacity-100"
                aria-hidden
              >
                <Expand className="h-4 w-4" />
              </span>
            </button>
          </li>
        ) : (
          <li key={m.id}>
            <video
              src={m.url}
              poster={m.posterUrl ?? undefined}
              controls
              playsInline
              preload="metadata"
              aria-label={`Video from ${authorName}`}
              className="h-40 w-28 rounded-md bg-ink object-cover"
            />
          </li>
        ),
      )}
    </ul>
  );
}
