import type { Metadata } from 'next';
import { CultHome } from '@/components/home/cult-home';
import { WebsiteJsonLd } from '@/components/seo/json-ld';
import { BRAND } from '@/lib/brand';
import { HomepageService } from '@/services/homepage.service';
import { ProductService } from '@/services/product.service';

/**
 * The homepage is an editorial campaign first and a storefront second: a
 * sequence of full-bleed category bands, with product rails appearing only
 * where an editor has asked for one.
 *
 * Everything is server-rendered — bands, headings and links are in the initial
 * HTML, so the page is crawlable and navigation never waits on JavaScript.
 * Composition comes entirely from the database, editable in Admin → Homepage.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: `${BRAND.name} Clothing | ${BRAND.tagline}`,
  description: BRAND.description,
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  const [sections, bestSellers] = await Promise.all([
    HomepageService.getSections(),
    ProductService.byFlag('bestseller', 8),
  ]);
  return (
    <>
      <h1 className="sr-only">
        {BRAND.name} — {BRAND.description}
      </h1>
      <CultHome bestSellers={bestSellers} slides={sections.map((section) => ({
        id: section.id,
        title: section.title,
        href: section.href,
        desktopImage: section.desktopImage,
        mobileImage: section.mobileImage,
        imageAlt: section.imageAlt,
        focalDesktop: section.focalDesktop,
        focalMobile: section.focalMobile,
      }))} />
      <WebsiteJsonLd />
    </>
  );
}
