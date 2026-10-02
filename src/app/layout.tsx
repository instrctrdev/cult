import type { Metadata, Viewport } from 'next';
import { Cinzel, Cormorant_Garamond, Dancing_Script, DM_Sans } from 'next/font/google';
import { BRAND, BRAND_COLORS } from '@/lib/brand';
import { env, publicEnv } from '@/lib/env';
import { MetaPixel } from '@/components/analytics/meta-pixel';
import { Providers } from './providers';
import './globals.css';

/**
 * The typefaces used by the CULT storefront. Self-hosted by next/font,
 * so there is no render-blocking request to Google and no layout shift.
 */
const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-cinzel',
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const dancingScript = Dancing_Script({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-script',
  display: 'swap',
});

const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    // Matches the live store's title, without the duplicated brand suffix.
    default: `${BRAND.name} Clothing | ${BRAND.tagline}`,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  authors: [{ name: BRAND.legalName }],
  keywords: ['CULT Clothing', 'men\'s fashion', 'streetwear', 'shirts', 'India', 'cargo pants'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.description,
    url: siteUrl,
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  formatDetection: { telephone: false },
  // Google Merchant Center and Search Console both verify ownership by finding
  // this token in the head. Omitted entirely when unset, rather than rendering
  // an empty tag that reads as a failed verification.
  ...(env().GOOGLE_SITE_VERIFICATION
    ? { verification: { google: env().GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pinch-to-zoom disabled for the app-like feel most storefronts on phones
  // go for. Product photography already has its own zoom on the PDP gallery.
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: BRAND_COLORS.background,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-IN"
      className={`${cinzel.variable} ${cormorant.variable} ${dmSans.variable} ${dancingScript.variable}`}
      suppressHydrationWarning
    >
      <body>
        <a href="#main" className="skip-link">Skip to main content</a>
        <MetaPixel />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
