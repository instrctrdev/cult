/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    // Product media is served from Hostinger's own filesystem via /uploads.
    // The Shopify CDN pattern stays allowed only so the one-time catalogue
    // import can render before assets are localised.
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.shopify.com' }],
    formats: ['image/avif', 'image/webp'],
    qualities: [82],
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [64, 96, 128, 192, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  experimental: { optimizePackageImports: ['lucide-react', 'framer-motion'] },
  // Next's dev server blocks cross-origin requests by default (anti DNS-rebinding).
  // Needed only for `next dev` tunnelled through ngrok/similar — has no effect
  // on `next build`/`next start`, so it's safe to leave in permanently.
  allowedDevOrigins: ['10.124.87.56', '*.ngrok-free.app', '*.ngrok-free.dev', '*.ngrok.app', '*.ngrok.io'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
      { source: '/uploads/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    ];
  },
  async redirects() {
    return [{ source: '/collections/:slug', destination: '/category/:slug', permanent: true }];
  },
};
export default nextConfig;
