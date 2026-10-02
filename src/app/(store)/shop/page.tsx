import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProductService } from '@/services/product.service';
import { productQuerySchema } from '@/lib/validation';
import { ProductGridSkeleton } from '@/components/ui/skeleton';
import { ListingPage } from '@/components/shop/listing-page';
import { BRAND } from '@/lib/brand';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const raw = await searchParams;
  const collection = typeof raw.collection === 'string' ? raw.collection : undefined;
  const heading = collection ? COLLECTION_HEADINGS[collection] : undefined;

  return {
    title: heading?.title ?? 'Shop all',
    description: heading
      ? `${heading.title} at ${BRAND.name}. ${BRAND.tagline}`
      : `Browse every ${BRAND.name} style — shirts, shakets and more. ${BRAND.tagline}`,
    alternates: { canonical: collection ? `/shop?collection=${collection}` : '/shop' },
  };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  return (
    <Suspense fallback={<ShopFallback />}>
      <ShopContent raw={raw} />
    </Suspense>
  );
}

async function ShopContent({ raw }: { raw: Record<string, string | string[] | undefined> }) {
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v != null),
  ) as Record<string, string>;

  // Bad query strings degrade to defaults rather than throwing a 500.
  const parsed = productQuerySchema.safeParse(flat);
  const q = parsed.success ? parsed.data : productQuerySchema.parse({});

  const listing = await ProductService.list({
    collection: q.collection,
    categorySlugs: q.category?.split(',').filter(Boolean),
    sizeCodes: q.size?.split(',').filter(Boolean),
    colorSlugs: q.color?.split(',').filter(Boolean),
    minPricePaise: q.minPrice != null ? q.minPrice * 100 : undefined,
    maxPricePaise: q.maxPrice != null ? q.maxPrice * 100 : undefined,
    inStockOnly: Boolean(q.inStock),
    onSaleOnly: Boolean(q.onSale),
    search: q.q,
    sort: q.sort,
    page: 1,
    perPage: q.perPage,
  });

  const heading = COLLECTION_HEADINGS[q.collection ?? ''] ?? {
    title: 'Shop all',
    // No eyebrow here — the brand tagline already runs through the header
    // and footer on every page, and repeating it above "Shop all" specifically
    // was just extra vertical space with nothing new to say.
    eyebrow: '',
  };

  return (
    <ListingPage
      title={heading.title}
      description={`${listing.total} ${listing.total === 1 ? 'style' : 'styles'}`}
      listing={listing}
      breadcrumbs={[
        { name: 'Home', href: '/' },
        { name: 'Shop', href: '/shop' },
        ...(q.collection ? [{ name: heading.title, href: `/shop?collection=${q.collection}` }] : []),
      ]}
      listName={heading.title}
    />
  );
}

/**
 * Display names for the curated collections the editorial homepage links to,
 * so `/shop?collection=fresh-arrivals` reads as "Fresh Arrivals" rather than
 * a generic "Shop all".
 */
const COLLECTION_HEADINGS: Record<string, { title: string; eyebrow: string }> = {
  'fresh-arrivals': { title: 'Fresh Arrivals', eyebrow: 'Just landed' },
  'best-sellers': { title: 'Best Sellers', eyebrow: BRAND.motto },
  sale: { title: 'Sale', eyebrow: 'Limited stock' },
  featured: { title: 'Featured', eyebrow: BRAND.tagline },
};

function ShopFallback() {
  return (
    <div className="container py-10">
      <ProductGridSkeleton />
    </div>
  );
}
