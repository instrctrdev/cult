/**
 * Brand constants for the CULT storefront. See docs/BRAND.md for the current
 * copy and visual identity used by this project.
 */
export const BRAND = {
  name: 'CULT',
  legalName: 'CULT Clothing',
  tagline: 'Dress Like You Mean It.',
  subTagline: 'Modern pieces. A sharper point of view.',
  motto: 'Make It Your Uniform.',
  intent: 'Dress with conviction',
  /**
   * The brand's positioning line. Kept separate from `description` because
   * that one is the SEO meta description on every page and has to stay a
   * self-contained sentence about what the store sells.
   */
  positioning: 'Thoughtful clothing for people who make their own rules.',
  description:
    'CULT Clothing makes modern, expressive pieces with a sharp point of view and everyday wearability.',
  established: '2026',
  city: 'India',
  country: 'India',
  instagram: 'https://www.instagram.com/cult.vizag/',
  email: '',
  phoneDisplay: '' as string,
  /** Marquee words shown between the header and the hero. */
  marquee: ['CULT 001', 'Made To Move', 'Built To Be Worn', 'Dress Like You Mean It'],
  announcements: [
    'CULT 001 Is Here',
    'Cult.Vizag',
    'Made To Move.',
  ],
} as const;

/** CULT colour tokens. Mirrors the CSS custom properties in globals.css. */
export const BRAND_COLORS = {
  background: '#ffffff',
  surface: '#f3f3f1',
  surfaceSunken: '#e8e8e6',
  ink: '#101010',
  gold: '#d4261e',
  success: '#2a7a4b',
} as const;

/** Footer link groups, matching the live site's information architecture. */
export const FOOTER_LINKS = {
  'Get to Know Us': [
    { label: 'About Us', href: '/pages/about-us' },
    { label: 'Contact Us', href: '/pages/contact' },
  ],
  Policies: [
    { label: 'Terms and Conditions', href: '/pages/terms-and-conditions' },
    { label: 'Privacy Policy', href: '/pages/privacy-policy' },
    { label: 'Return & Exchange Policy', href: '/pages/return-exchange-policy' },
    { label: 'Shipping and Delivery Policy', href: '/pages/shipping-and-delivery-policy' },
  ],
  Orders: [
    { label: 'Track Order', href: '/track-order' },
    { label: 'Exchange / Return Request', href: '/account/orders' },
    { label: 'Wishlist', href: '/wishlist' },
  ],
} as const;
