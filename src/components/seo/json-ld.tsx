import { BRAND } from '@/lib/brand';
import { publicEnv } from '@/lib/env';
import { toRupees } from '@/lib/money';
import type { ProductDetailDTO } from '@/types';

const site = publicEnv.NEXT_PUBLIC_SITE_URL;

/**
 * Structured data is emitted from the server as a plain script tag.
 * `JSON.stringify` output is escaped so a product name containing `</script>`
 * cannot break out of the block.
 */
function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export function OrganizationJsonLd() {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: BRAND.name,
        alternateName: BRAND.legalName,
        url: site,
        description: BRAND.description,
        foundingDate: BRAND.established,
        address: {
          '@type': 'PostalAddress',
          addressLocality: BRAND.city,
          addressCountry: 'IN',
        },
        sameAs: [BRAND.instagram],
      }}
    />
  );
}

export function WebsiteJsonLd() {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: BRAND.name,
        url: site,
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${site}/search?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      }}
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; href: string }[] }) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: item.name,
          item: `${site}${item.href}`,
        })),
      }}
    />
  );
}

export function ProductJsonLd({ product }: { product: ProductDetailDTO }) {
  const inStock = product.variants.some((v) => v.inStock);
  const prices = product.variants.map((v) => toRupees(v.pricePaise));

  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.metaDescription ?? undefined,
        sku: product.variants[0]?.sku,
        brand: { '@type': 'Brand', name: BRAND.name },
        image: product.images.filter((i) => !i.isPlaceholder).map((i) => `${site}${i.url}`),
        // AggregateOffer describes the real size range rather than one price.
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'INR',
          lowPrice: Math.min(...prices),
          highPrice: Math.max(...prices),
          offerCount: product.variants.length,
          availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: `${site}/product/${product.slug}`,
        },
        // Emitted only when real approved reviews exist — never fabricated.
        ...(product.rating
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: product.rating.average,
                reviewCount: product.rating.count,
              },
            }
          : {}),
      }}
    />
  );
}
