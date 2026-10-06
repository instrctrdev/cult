import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { ChevronRight } from 'lucide-react';
import { ProductService } from '@/services/product.service';
import { getCurrentUser } from '@/lib/auth/session';
import { getSettings } from '@/lib/settings';
import { ProductGallery } from '@/components/product/product-gallery';
import { ProductPurchase } from '@/components/product/product-purchase';
import { ProductDetailsAccordion } from '@/components/product/product-details-accordion';
import { ProductReviews } from '@/components/product/product-reviews';
import { ProductRail } from '@/components/product/product-rail';
import { RecentlyViewedTracker } from '@/components/product/recently-viewed';
import { ProductViewTracker } from '@/components/product/product-view-tracker';
import { BreadcrumbJsonLd, ProductJsonLd } from '@/components/seo/json-ld';
import { BRAND } from '@/lib/brand';

export const revalidate = 300;

type Params = Promise<{ slug: string }>;

// Generate and cache product pages on first request so a temporary database
// outage during deployment cannot fail the entire application build.
export function generateStaticParams() { return []; }

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await ProductService.getBySlug(slug);
  if (!product) return { title: 'Product not found' };

  const images = product.images.filter((i) => !i.isPlaceholder).map((i) => i.url);

  return {
    title: product.metaTitle ?? product.name,
    description: product.metaDescription ?? `${product.name} — ${BRAND.description}`,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      type: 'website',
      title: product.name,
      description: product.metaDescription ?? BRAND.description,
      url: `/product/${product.slug}`,
      images: images.length ? images : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description: product.metaDescription ?? BRAND.description,
      images: images.length ? [images[0]] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;

  const product = await ProductService.getBySlug(slug);

  if (!product) {
    // The live store's handles often disagree with their product names, so an
    // old Shopify URL is 301'd to the clean slug rather than 404'd.
    const redirectTo = await ProductService.slugForLegacyHandle(slug);
    if (redirectTo && redirectTo !== slug) permanentRedirect(`/product/${redirectTo}`);
    notFound();
  }

  const [related, user, settings] = await Promise.all([
    ProductService.related(product.id, 8),
    getCurrentUser(),
    getSettings(),
  ]);

  const category = product.categories[0];
  const breadcrumbs = [
    { name: 'Home', href: '/' },
    { name: 'Shop', href: '/shop' },
    ...(category ? [{ name: category.name, href: `/category/${category.slug}` }] : []),
    { name: product.name, href: `/product/${product.slug}` },
  ];

  return (
    <>
      <div className="container pt-4 lg:pt-8">
        <nav aria-label="Breadcrumb" className="mb-4 lg:mb-6">
          <ol className="flex flex-wrap items-center gap-1 text-2xs uppercase tracking-wide2 text-muted">
            {breadcrumbs.map((crumb, i) => (
              <li key={crumb.href} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 text-faint" aria-hidden />}
                {i === breadcrumbs.length - 1 ? (
                  <span aria-current="page" className="max-w-[50vw] truncate text-ink">{crumb.name}</span>
                ) : (
                  <Link href={crumb.href} className="hover:text-ink hover:underline">{crumb.name}</Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <div className="lg:container">
        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-12 xl:gap-16">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+2rem)]">
            <ProductGallery images={product.images} videos={product.videos} productName={product.name} />
          </div>

          <div className="px-4 pb-8 pt-6 sm:px-6 lg:px-0 lg:pt-0">
            <ProductPurchase
              product={product}
              isSignedIn={Boolean(user)}
              freeShippingThresholdPaise={settings['shipping.free_threshold_paise'] as number}
              shippingFeePaise={settings['shipping.fee_paise'] as number}
              freeShippingEnabled={settings['shipping.free_enabled'] as boolean}
              prepaidFreeShipping={settings['shipping.prepaid_free_enabled'] as boolean}
            />

            <div className="mt-8">
              <ProductDetailsAccordion product={product} />
            </div>
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <ProductReviews productId={product.id} />
      </Suspense>

      {related.length > 0 && (
        <ProductRail title="You may also like" products={related} />
      )}

      <ProductJsonLd product={product} />
      <BreadcrumbJsonLd items={breadcrumbs} />
      <RecentlyViewedTracker productId={product.id} />
      <ProductViewTracker slug={product.slug} />
    </>
  );
}
