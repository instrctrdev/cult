import type { Metadata } from 'next';
import { CultHome } from '@/components/home/cult-home';
import { WebsiteJsonLd } from '@/components/seo/json-ld';
import { BRAND } from '@/lib/brand';
import { HomepageService } from '@/services/homepage.service';
import { ProductService } from '@/services/product.service';

/** Campaign imagery, live bestsellers and static CULT collection photography. */
export const revalidate = 300;

export const metadata: Metadata = {
  title: `${BRAND.name} Clothing | ${BRAND.tagline}`,
  description: BRAND.description,
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  const [sections, bestSellers, trendingProducts, categoryPromos, reels] = await Promise.all([
    HomepageService.getSections().catch((error) => {
      console.error('[home] campaign sections unavailable', error);
      return [];
    }),
    ProductService.byFlag('bestseller', 8).catch((error) => {
      console.error('[home] bestsellers unavailable', error);
      return [];
    }),
    ProductService.byFlag('trending', 5).catch((error) => {
      console.error('[home] trending products unavailable', error);
      return [];
    }),
    HomepageService.getCategoryPromos().catch((error) => {
      console.error('[home] category promotions unavailable', error);
      return [];
    }),
    HomepageService.getReels().catch((error) => {
      console.error('[home] reels unavailable', error);
      return [];
    }),
  ]);
  return (
    <>
      <CultHome bestSellers={bestSellers} trendingProducts={trendingProducts} categoryPromos={categoryPromos} reels={reels} slides={sections.map((section) => ({
        id: section.id,
        key: section.key,
        title: section.title,
        subtitle: section.subtitle,
        ctaLabel: section.ctaLabel,
        href: section.href,
        desktopImage: section.desktopImage,
        mobileImage: section.mobileImage,
        imageAlt: section.imageAlt,
        focalDesktop: section.focalDesktop,
        focalMobile: section.focalMobile,
        videoUrl: section.videoUrl,
        textMode: section.textMode,
      }))} />
      <WebsiteJsonLd />
    </>
  );
}
