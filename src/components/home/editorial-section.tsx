import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Reveal } from './reveal';
import type { HomepageSectionDTO } from '@/services/homepage.service';

/**
 * A full-bleed editorial band — the building block of the homepage.
 *
 * Shape
 *   Desktop (≥1024px): 16:9, capped so it cannot exceed the viewport height.
 *   Mobile  (<768px):  tall portrait, ~88svh, like a campaign poster.
 *
 * Wording
 *   Some campaign artwork carries its own typography burned in
 *   ("FRESH ARRIVALS", "+ SHOP NOW"), so `textMode: 'IMAGE'` draws nothing over
 *   the photograph. The heading and CTA still exist in the markup — visually
 *   hidden — so the band keeps a real `<h2>`, a crawlable link and a sensible
 *   accessible name. Switching a section to `'OVERLAY'` renders the words.
 *
 * Linking
 *   The whole band is one anchor, so the entire image is clickable, and it is a
 *   plain `<a href>` — navigation never depends on JavaScript.
 *
 * This is a server component; only the scroll reveal is client-side.
 */
export function EditorialSection({
  section,
  index,
}: {
  section: HomepageSectionDTO;
  index: number;
}) {
  const hasArt = Boolean(section.desktopImage || section.mobileImage || section.videoUrl);
  const showsText = section.textMode === 'OVERLAY';
  const isFirstBand = index === 0;

  // Only the hero is above the fold; everything below it loads lazily.
  const eager = section.priority || isFirstBand;

  const content = (
    <>
      {hasArt ? (
        <SectionMedia section={section} eager={eager} />
      ) : (
        <ArtworkPending section={section} />
      )}

      {/* Readability gradient. Kept off when the artwork carries no text and
          needs no scrim, so photography stays the dominant element. */}
      {hasArt && section.overlayStrength > 0 && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(to bottom, transparent 40%, rgba(0,0,0,${
              section.overlayStrength / 100
            }) 100%)`,
          }}
          aria-hidden
        />
      )}

      {section.comingSoon && (
        <div className="pointer-events-none absolute inset-0 bg-ink/25" aria-hidden />
      )}

      {/* The heading always exists. It is only *visible* in OVERLAY mode. */}
      <div
        className={cn(
          'absolute inset-0 flex p-6 sm:p-10 lg:p-14',
          ALIGN[section.textAlign],
          !showsText && 'sr-only',
        )}
      >
        <Reveal className={cn('max-w-2xl', TEXT_ALIGN[section.textAlign])}>
          {section.subtitle && showsText && (
            <p
              className={cn(
                'mb-3 text-2xs uppercase tracking-luxe',
                section.theme === 'LIGHT' ? 'text-white/75' : 'text-ink/60',
              )}
            >
              {section.subtitle}
            </p>
          )}

          <h2
            id={`section-${section.key}`}
            className={cn(
              'font-sans font-black uppercase leading-[0.9]',
              'text-4xl sm:text-5xl lg:text-6xl xl:text-7xl',
              section.theme === 'LIGHT' ? 'text-white' : 'text-ink',
            )}
          >
            {section.title}
          </h2>

          {showsText && !section.comingSoon && (
            <span
              className={cn(
                'mt-6 inline-block border-b pb-1 text-xs font-bold uppercase transition-[gap,opacity]',
                section.theme === 'LIGHT'
                  ? 'border-white/50 text-white group-hover:border-white'
                  : 'border-ink/40 text-ink group-hover:border-ink',
              )}
            >
              {section.ctaLabel}
            </span>
          )}

          {/* Screen-reader-only CTA when the artwork carries the words. */}
          {!showsText && !section.comingSoon && <span>{section.ctaLabel}</span>}
        </Reveal>
      </div>

      {section.comingSoon && (
        <div className={cn('absolute inset-0 flex p-6 sm:p-10 lg:p-14', ALIGN[section.textAlign])}>
          <span className="rounded-full border border-white/60 bg-black/30 px-4 py-1.5 text-2xs font-medium uppercase tracking-luxe text-white backdrop-blur-sm">
            Coming Soon
          </span>
        </div>
      )}
    </>
  );

  return (
    <section
      aria-labelledby={`section-${section.key}`}
      className={cn(
        'relative isolate w-full overflow-hidden bg-sunken',
        // The band matches the artwork's own aspect ratio rather than a
        // viewport-height box. Campaign artwork carries its wording inside the
        // frame, and a mismatched container would crop that wording away.
        //   phones  → 9:16 poster
        //   tablet  → 3:2
        //   desktop → 16:9 editorial frame
        'aspect-[9/16] min-h-[520px]',
        'md:aspect-[3/2] md:min-h-0',
        'lg:aspect-video',
        // Phones get a ceiling so a very tall device cannot stretch the poster;
        // desktop deliberately has none. Capping a 16:9 band on a short window
        // would re-crop the artwork horizontally and cut the campaign lockup,
        // and a band running slightly past the fold is normal editorial
        // behaviour — it invites the scroll.
        'max-h-[94svh] md:max-h-none',
      )}
    >
      {section.comingSoon ? (
        // Nothing to buy yet, so the band is a preview rather than a link —
        // sending someone to an empty category page would be worse than not
        // linking at all.
        <div className="group absolute inset-0 block cursor-default" aria-label={`${section.title} — coming soon`}>
          {content}
        </div>
      ) : (
        <Link href={section.href} className="group absolute inset-0 block" aria-label={`${section.title} — ${section.ctaLabel}`}>
          {content}
        </Link>
      )}
    </section>
  );
}

/**
 * Two crops, one rendered at a time.
 *
 * `sizes="100vw"` plus the `md:hidden` / `hidden md:block` pair means the
 * browser only downloads the crop for the breakpoint in play — a phone never
 * fetches the 2400px landscape file.
 */
function SectionMedia({ section, eager }: { section: HomepageSectionDTO; eager: boolean }) {
  if (section.videoUrl) {
    return (
      <video
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: section.focalDesktop }}
        src={section.videoUrl}
        poster={section.desktopImage ?? undefined}
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
      />
    );
  }

  return (
    <>
      {section.mobileImage && (
        <Image
          src={section.mobileImage}
          alt={section.imageAlt}
          fill
          sizes="100vw"
          priority={eager}
          loading={eager ? undefined : 'lazy'}
          quality={82}
          className="object-cover transition-transform [transition-duration:1200ms] ease-out group-hover:scale-[1.02] md:hidden"
          style={{ objectPosition: section.focalMobile }}
        />
      )}
      {section.desktopImage && (
        <Image
          src={section.desktopImage}
          alt={section.mobileImage ? '' : section.imageAlt}
          aria-hidden={section.mobileImage ? true : undefined}
          fill
          sizes="100vw"
          priority={eager}
          loading={eager ? undefined : 'lazy'}
          quality={82}
          className="hidden object-cover transition-transform [transition-duration:1200ms] ease-out group-hover:scale-[1.02] md:block"
          style={{ objectPosition: section.focalDesktop }}
        />
      )}
    </>
  );
}

/**
 * Shown when no artwork has been supplied yet.
 *
 * Deliberately explicit: it names the exact file paths to drop images at, so
 * the homepage is self-documenting rather than silently blank.
 */
function ArtworkPending({ section }: { section: HomepageSectionDTO }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-surface to-sunken px-6">
      <div className="max-w-md text-center">
        <p className="font-display text-2xl uppercase tracking-luxe text-ink/70 sm:text-4xl">
          {section.title}
        </p>
        <p className="mt-4 text-2xs uppercase tracking-wide2 text-muted">Artwork pending</p>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Add <code className="rounded bg-ink/[0.06] px-1.5 py-0.5">{section.expectedDesktopPath}</code>
          {' '}and{' '}
          <code className="rounded bg-ink/[0.06] px-1.5 py-0.5">{section.expectedMobilePath}</code>
          , or upload in Admin → Homepage.
        </p>
      </div>
    </div>
  );
}

const ALIGN: Record<HomepageSectionDTO['textAlign'], string> = {
  CENTER: 'items-center justify-center',
  BOTTOM_LEFT: 'items-end justify-start',
  BOTTOM_CENTER: 'items-end justify-center',
  BOTTOM_RIGHT: 'items-end justify-end',
  TOP_LEFT: 'items-start justify-start',
};

const TEXT_ALIGN: Record<HomepageSectionDTO['textAlign'], string> = {
  CENTER: 'text-center',
  BOTTOM_LEFT: 'text-left',
  BOTTOM_CENTER: 'text-center',
  BOTTOM_RIGHT: 'text-right',
  TOP_LEFT: 'text-left',
};
