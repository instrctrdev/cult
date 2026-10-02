import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/brand';
import type { BannerDTO } from '@/services/banner.service';

/**
 * Homepage hero.
 *
 * Three renderings, chosen by the data rather than by a code change:
 *
 *   video mode — `videoUrl` is set; the still image becomes the poster frame.
 *   image mode — `desktopImage` / `mobileImage` are set.
 *   type mode  — no artwork uploaded yet. Renders a composed typographic
 *                panel using the banner's own copy instead of reserving a
 *                viewport-sized empty box, so an un-uploaded hero still looks
 *                deliberate rather than broken.
 *
 * No video ships today, per the brief. `<HeroMedia>` is the seam.
 */
export function HeroSection({ banner }: { banner: BannerDTO | null }) {
  const hasMedia = Boolean(banner?.videoUrl || banner?.desktopImage || banner?.mobileImage);

  if (!banner) return <TypographicHero />;
  if (!hasMedia) return <TypographicHero banner={banner} />;

  return (
    <section className="relative isolate overflow-hidden bg-sunken" aria-labelledby="hero-title">
      {/* Capped so a tall desktop window cannot stretch the hero indefinitely. */}
      <div className="relative h-[78svh] max-h-[860px] min-h-[460px] w-full md:h-[84svh]">
        <HeroMedia banner={banner} />

        {banner.overlay && (
          <div className="absolute inset-0" style={{ backgroundColor: banner.overlay }} aria-hidden />
        )}

        <div className="absolute inset-0 flex items-end pb-14 md:items-center md:pb-0">
          <div className="container">
            <div className="max-w-xl text-white">
              {banner.eyebrow && (
                <p className="mb-3 text-2xs uppercase tracking-luxe text-white/75">{banner.eyebrow}</p>
              )}

              <h1 id="hero-title" className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                {banner.title}
              </h1>

              {banner.subtitle && (
                <p className="mt-4 max-w-md text-base text-white/85 text-pretty sm:text-lg">{banner.subtitle}</p>
              )}

              {banner.ctaLabel && banner.ctaHref && (
                <Link
                  href={banner.ctaHref}
                  className="mt-7 inline-flex h-13 items-center rounded-md bg-white px-8 text-xs font-medium uppercase tracking-luxe text-ink transition-colors hover:bg-white/90"
                >
                  {banner.ctaLabel} →
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The media seam. Swapping to video is a data change, not a code change.
 * `poster` reuses the still so the first frame is never blank.
 */
function HeroMedia({ banner }: { banner: BannerDTO }) {
  if (banner.videoUrl) {
    return (
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={banner.videoUrl}
        poster={banner.desktopImage ?? undefined}
        autoPlay
        muted
        loop
        playsInline
        // Decorative: the headline beside it carries the meaning.
        aria-hidden
      />
    );
  }

  const desktop = banner.desktopImage ?? banner.mobileImage;
  const mobile = banner.mobileImage ?? banner.desktopImage;

  return (
    <>
      {mobile && (
        <Image src={mobile} alt="" aria-hidden fill priority sizes="100vw" className="object-cover md:hidden" />
      )}
      {desktop && (
        <Image src={desktop} alt="" aria-hidden fill priority sizes="100vw" className="hidden object-cover md:block" />
      )}
    </>
  );
}

/**
 * Editorial hero used until artwork is uploaded.
 *
 * Uses the banner's own copy when there is one, falling back to the brand's
 * real taglines. Sized to its content, so there is never a large empty area.
 */
function TypographicHero({ banner }: { banner?: BannerDTO }) {
  const eyebrow = banner?.eyebrow ?? BRAND.announcements[0];
  const subtitle = banner?.subtitle ?? BRAND.description;
  const ctaLabel = banner?.ctaLabel ?? 'Explore collection';
  const ctaHref = banner?.ctaHref ?? '/shop';

  // Without a banner, the tagline is set as three stacked words.
  const headingLines = banner
    ? [banner.title]
    : BRAND.tagline.split('. ').map((w) => w.replace(/\.$/, ''));

  return (
    <section className="relative overflow-hidden border-b border-line bg-surface" aria-labelledby="hero-title">
      {/* Subtle gold wash so the panel reads as designed, not unfinished. */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-gold/[0.07] blur-3xl"
        aria-hidden
      />

      <div className="container relative grid gap-10 py-16 md:py-24 lg:grid-cols-12 lg:items-center lg:py-28">
        <div className="lg:col-span-7">
          <p className="eyebrow mb-4">{eyebrow}</p>

          <h1
            id="hero-title"
            className={cn(
              'font-display font-bold leading-[1.03] tracking-tight',
              headingLines.length > 1 ? 'text-4xl sm:text-5xl lg:text-6xl' : 'text-3xl sm:text-4xl lg:text-5xl',
            )}
          >
            {headingLines.map((line, i) => (
              <span key={i} className="block">{line}</span>
            ))}
          </h1>

          <p className="mt-5 max-w-md text-base text-muted text-pretty sm:text-lg">{subtitle}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={ctaHref}
              className="inline-flex h-13 items-center rounded-md bg-ink px-8 text-xs font-medium uppercase tracking-luxe text-bg transition-colors hover:bg-ink/90"
            >
              {ctaLabel} →
            </Link>
            <Link
              href="/category/best-sellers"
              className="inline-flex h-13 items-center rounded-md border border-ink/25 px-8 text-xs font-medium uppercase tracking-luxe text-ink transition-colors hover:border-ink"
            >
              Best sellers
            </Link>
          </div>
        </div>

        {/* Brand marks — real store facts, no invented statistics. */}
        <ul className="grid grid-cols-3 gap-x-3 gap-y-4 border-t border-line pt-8 sm:gap-x-6 lg:col-span-5 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          {[
            { value: BRAND.established, label: 'Established' },
            { value: BRAND.city, label: BRAND.country },
            { value: 'Rs. 599', label: 'Starting price' },
          ].map((item) => (
            <li key={item.label} className="min-w-0">
              {/* Sized down on narrow screens so "Visakhapatnam" cannot collide. */}
              <p className="font-serif text-base leading-tight text-ink sm:text-xl lg:text-2xl">{item.value}</p>
              <p className="mt-1 text-2xs uppercase tracking-wide2 text-muted">{item.label}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
