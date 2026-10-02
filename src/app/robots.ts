import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Nothing transactional or personal should ever be indexed.
        disallow: ['/admin', '/api/', '/account', '/checkout', '/cart', '/search', '/wishlist'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
