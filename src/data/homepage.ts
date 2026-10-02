/**
 * Default homepage composition.
 *
 * This is the *seed* for `HomepageSection`, not the runtime source — once
 * seeded, the homepage is driven entirely by the database so it can be edited
 * in Admin → Homepage without a deploy.
 *
 * ── Artwork ────────────────────────────────────────────────────────────────
 * Each band expects two crops, because a 16:9 landscape composition rarely
 * survives being squeezed into a 9:16 phone frame:
 *
 *   public/images/home/<key>-desktop.jpg   →  16:9  (2400×1350 recommended)
 *   public/images/home/<key>-mobile.jpg    →  9:16  (1080×1920 recommended)
 *
 * Drop files at those exact paths and they appear automatically — the renderer
 * checks whether the file exists and falls back to a labelled placeholder when
 * it does not. Uploading through the admin panel works too and overrides these.
 *
 * ── Wording ────────────────────────────────────────────────────────────────
 * `textMode: 'IMAGE'` means the artwork already carries its own wording
 * ("FRESH ARRIVALS", "+ SHOP NOW"), so nothing is drawn on top of it. The
 * `title` and `ctaLabel` below are still required: they become the accessible
 * name of the link and a visually-hidden heading, so the section remains
 * crawlable and usable with a screen reader. Switch a section to `'OVERLAY'`
 * in the admin to have the app render the words instead.
 */

export type SectionTextMode = 'IMAGE' | 'OVERLAY';
export type SectionTextAlign = 'CENTER' | 'BOTTOM_LEFT' | 'BOTTOM_CENTER' | 'BOTTOM_RIGHT' | 'TOP_LEFT';
export type SectionTheme = 'LIGHT' | 'DARK';

export interface HomepageSectionSeed {
  key: string;
  title: string;
  subtitle?: string | null;
  ctaLabel?: string | null;
  href: string;
  desktopImage?: string | null;
  mobileImage?: string | null;
  imageAlt?: string | null;
  focalDesktop?: string;
  focalMobile?: string;
  textMode?: SectionTextMode;
  textAlign?: SectionTextAlign;
  theme?: SectionTheme;
  overlayStrength?: number;
  showProductRail?: boolean;
  railSource?: string | null;
  priority?: boolean;
  comingSoon?: boolean;
  isActive?: boolean;
}

export const DEFAULT_HOMEPAGE_SECTIONS: HomepageSectionSeed[] = [
  {
    key: 'hero',
    title: 'CULT 001',
    subtitle: 'Modern uniform. Zero compromise.',
    ctaLabel: 'Shop the drop',
    href: '/shop',
    desktopImage: '/images/cult/home-hero-desktop.jpg',
    mobileImage: '/images/cult/home-hero-mobile.jpg',
    imageAlt: 'CULT campaign model in a white embroidered overshirt and black cargo trousers',
    focalDesktop: '50% 50%',
    focalMobile: '50% 50%',
    textAlign: 'BOTTOM_LEFT',
    theme: 'DARK',
    overlayStrength: 0,
    textMode: 'OVERLAY',
    priority: true,
    // Product rails become active as soon as the real CULT catalogue is imported.
    // Leaving it off avoids presenting a seeded development placeholder as stock.
    showProductRail: false,
    isActive: true,
  },
  {
    key: 'fresh-arrivals',
    title: 'Contour Knit Polo',
    subtitle: null,
    ctaLabel: null,
    href: '/category/polos',
    desktopImage: '/images/cult/hero-polo-desktop.jpg',
    mobileImage: '/images/cult/edit-polo.jpg',
    imageAlt: 'Model in CULT black ribbed polo and cargo trousers',
    focalDesktop: 'right center',
    focalMobile: 'center top',
    textMode: 'IMAGE',
    isActive: true,
  },
  {
    key: 'shirts',
    title: 'Shirts',
    subtitle: 'Everyday tailoring, relaxed',
    ctaLabel: '+ SHOP NOW',
    href: '/category/shirts',
    imageAlt: 'CULT shirts',
    textAlign: 'CENTER',
    // No editorial photograph for this band yet — shirts already sell fine
    // through the header nav and the Fresh Arrivals rail.
    isActive: false,
  },
  {
    key: 'polos',
    title: 'Shirts In Bloom',
    ctaLabel: null,
    href: '/category/shirts',
    desktopImage: '/images/cult/hero-sunflower-desktop.jpg',
    mobileImage: '/images/cult/edit-sunflower-shirt.jpg',
    imageAlt: 'Model in CULT striped sunflower embroidered shirt',
    focalDesktop: 'left center',
    focalMobile: 'center top',
    textMode: 'IMAGE',
    textAlign: 'BOTTOM_CENTER',
    comingSoon: false,
    isActive: true,
  },
  {
    key: 't-shirts',
    title: 'T-Shirts',
    ctaLabel: '+ SHOP NOW',
    href: '/category/t-shirts',
    imageAlt: 'CULT t-shirts',
    textAlign: 'BOTTOM_LEFT',
    isActive: false,
  },
  {
    key: 'bottoms',
    title: 'Bottoms',
    ctaLabel: '+ SHOP NOW',
    href: '/category/bottoms',
    imageAlt: 'CULT trousers and bottoms',
    textAlign: 'BOTTOM_RIGHT',
    isActive: false,
  },
  {
    key: 'kurtas',
    title: 'Kurtas',
    ctaLabel: '+ SHOP NOW',
    href: '/category/kurtas',
    imageAlt: 'CULT kurtas',
    textAlign: 'CENTER',
    isActive: false,
  },
  {
    key: 'best-sellers',
    title: 'Best Sellers',
    subtitle: 'Made to move. Built to be worn.',
    ctaLabel: '+ SHOP NOW',
    href: '/shop?collection=best-sellers',
    imageAlt: 'CULT best selling styles',
    textAlign: 'BOTTOM_CENTER',
    showProductRail: true,
    railSource: 'bestseller',
    // No editorial photograph for this band yet.
    isActive: false,
  },
  {
    key: 'sale',
    title: 'Sale',
    subtitle: 'Season favourites, reduced',
    ctaLabel: '+ SHOP NOW',
    href: '/shop?collection=sale',
    imageAlt: 'CULT sale styles',
    textAlign: 'BOTTOM_LEFT',
    overlayStrength: 45,
    // No editorial photograph for this band yet.
    isActive: false,
  },
];

/** Categories the editorial homepage links to that the catalogue may not have yet. */
export const HOMEPAGE_CATEGORY_SLUGS = ['shirts', 'polos', 't-shirts', 'bottoms', 'kurtas'] as const;
