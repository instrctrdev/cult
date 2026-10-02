import Image from 'next/image';
import Link from 'next/link';
import type { BannerDTO } from '@/services/banner.service';

/**
 * The paired promotional panels the live homepage runs beneath the hero
 * ("Walk into every room winning." / "Make It Your Uniform.").
 */
export function SplitBanners({ banners }: { banners: BannerDTO[] }) {
  if (!banners.length) return null;

  return (
    <section className="container py-10 md:py-14" aria-label="Featured collections">
      <div className="grid gap-3 md:grid-cols-2 md:gap-5">
        {banners.slice(0, 2).map((banner) => {
          const image = banner.desktopImage ?? banner.mobileImage;
          const panelClass =
            'group relative isolate flex min-h-[300px] items-end overflow-hidden rounded-lg bg-sunken p-6 md:min-h-[420px] md:p-8';

          // A banner without a link is a panel, not a dead anchor.
          const body = (
            <>
              {image ? (
                <Image
                  src={image}
                  alt=""
                  fill
                  sizes="(min-width:768px) 50vw, 100vw"
                  className="-z-10 object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
              ) : (
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-sunken to-surface" aria-hidden />
              )}

              {image && (
                <div
                  className="absolute inset-0 -z-10"
                  style={{ backgroundColor: banner.overlay ?? 'rgba(26,26,26,0.30)' }}
                  aria-hidden
                />
              )}

              <div className={image ? 'text-white' : 'text-ink'}>
                {banner.eyebrow && <p className="mb-2 text-2xs uppercase tracking-luxe opacity-75">{banner.eyebrow}</p>}
                <h2 className="max-w-xs font-serif text-2xl leading-tight md:text-3xl">{banner.title}</h2>
                {banner.ctaLabel && (
                  <span className="mt-4 inline-flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide2 underline-offset-4 group-hover:underline">
                    {banner.ctaLabel} →
                  </span>
                )}
              </div>
            </>
          );

          return banner.ctaHref ? (
            <Link key={banner.id} href={banner.ctaHref} className={panelClass}>
              {body}
            </Link>
          ) : (
            <div key={banner.id} className={panelClass}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
