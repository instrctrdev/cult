import type { MetadataRoute } from 'next';
import { ProductService } from '@/services/product.service';
import { CategoryService } from '@/services/category.service';
import { prisma } from '@/lib/prisma';
import { publicEnv } from '@/lib/env';

/** Generated from live data — no hard-coded URL list to drift out of date. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');

  const [products, categories, pages] = await Promise.all([
    ProductService.allSlugs(),
    CategoryService.allSlugs(),
    prisma.page.findMany({
      where: { isPublished: true, deletedAt: null },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/shop`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/track-order`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  return [
    ...staticRoutes,
    ...categories.map((c) => ({
      url: `${base}/category/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: `${base}/product/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...pages.map((p) => ({
      url: `${base}/pages/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
  ];
}
