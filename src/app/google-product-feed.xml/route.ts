import { NextResponse } from 'next/server';
import { ProductStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { publicEnv } from '@/lib/env';
import { toPaise, toRupees } from '@/lib/money';
import { stripHtml } from '@/lib/utils';
import { BRAND } from '@/lib/brand';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_DESCRIPTION = 5000;
const MAX_ADDITIONAL_IMAGES = 10;

/**
 * Catalogue-wide facts Google requires on every apparel entry but which are
 * not modelled per product, because this catalogue is entirely one of each.
 * Change these here if the range ever widens beyond adult menswear.
 */
const GENDER = 'male';
const AGE_GROUP = 'adult';

/**
 * Google's own product taxonomy. Sending a category stops Google guessing,
 * and a wrong guess is what usually pushes an item into the wrong Shopping
 * surface. Anything unmatched falls back to the general clothing node.
 */
const CATEGORIES: { match: RegExp; path: string }[] = [
  { match: /jacket|coat/i, path: 'Apparel & Accessories > Clothing > Outerwear > Coats & Jackets' },
  { match: /shirt|polo|tee|t-shirt|top|hoodie|sweat/i, path: 'Apparel & Accessories > Clothing > Shirts & Tops' },
  { match: /trouser|pant|jean|short/i, path: 'Apparel & Accessories > Clothing > Pants' },
];
const CATEGORY_FALLBACK = 'Apparel & Accessories > Clothing';

/** XML text nodes must not carry raw markup characters. */
function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * GET /google-product-feed.xml — the feed Google Merchant Center reads.
 *
 * Separate from the Meta feed rather than shared, because the two want
 * different shapes. Meta gets one entry per product: it only needs to know
 * whether a shirt can be bought, and a shopper who clicks lands on the page
 * where they pick a size. Google gets **one entry per size**, tied together by
 * `item_group_id`, because Google treats a size as its own buyable offer.
 *
 * That distinction is the point of this feed. Half this catalogue is missing L
 * and XL. Per-product, Google would advertise a shirt as available to someone
 * who wears XL and land them on a page where they cannot buy it. Per-size, the
 * sizes that have actually run out are published as `out of stock` and Google
 * stops showing them.
 *
 * `mpn` carries the variant's SKU alongside `brand`, which is how Google
 * identifies own-brand goods that have no GTIN — the alternative,
 * `identifier_exists: no`, demotes the item in Shopping surfaces.
 *
 * Deliberately public and unauthenticated: Google fetches it anonymously, and
 * it exposes only what the storefront already shows.
 */
export async function GET() {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');

  const products = await prisma.product.findMany({
    where: { status: ProductStatus.ACTIVE, deletedAt: null },
    orderBy: { position: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      price: true,
      compareAtPrice: true,
      images: {
        where: { isPlaceholder: false },
        orderBy: { position: 'asc' },
        select: { url: true },
      },
      categories: { select: { category: { select: { name: true } } } },
      variants: {
        where: { isActive: true, deletedAt: null },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          sku: true,
          price: true,
          compareAtPrice: true,
          size: { select: { label: true, code: true } },
          color: { select: { name: true } },
          inventory: { select: { quantity: true, reserved: true } },
        },
      },
    },
  });

  const money = (paise: number) => `${toRupees(paise).toFixed(2)} INR`;

  const items = products
    // An item with no photograph is rejected by Merchant Center anyway.
    .filter((p) => p.images.length > 0)
    .flatMap((p) => {
      const category = p.categories[0]?.category.name ?? null;
      const haystack = `${category ?? ''} ${p.name}`;
      const googleCategory =
        CATEGORIES.find((c) => c.match.test(haystack))?.path ?? CATEGORY_FALLBACK;

      const description =
        stripHtml(p.description ?? '').slice(0, MAX_DESCRIPTION) || `${p.name} by ${BRAND.name}.`;

      const link = `${base}/product/${p.slug}`;
      const imageLinks = [
        `      <g:image_link>${xml(`${base}${p.images[0].url}`)}</g:image_link>`,
        ...p.images
          .slice(1, 1 + MAX_ADDITIONAL_IMAGES)
          .map((i) => `      <g:additional_image_link>${xml(`${base}${i.url}`)}</g:additional_image_link>`),
      ];

      return p.variants.map((v) => {
        const available = Math.max(
          0,
          (v.inventory?.quantity ?? 0) - (v.inventory?.reserved ?? 0),
        );

        // A variant may override the product's price; fall back to the product's.
        const pricePaise = toPaise(v.price ?? p.price);
        const comparePaise = v.compareAtPrice
          ? toPaise(v.compareAtPrice)
          : p.compareAtPrice
            ? toPaise(p.compareAtPrice)
            : null;
        // Google reads `price` as the list price and `sale_price` as what is
        // charged, so a discount has to send both or the saving is invisible.
        const onSale = comparePaise !== null && comparePaise > pricePaise;

        return [
          '    <item>',
          `      <g:id>${xml(v.sku || v.id)}</g:id>`,
          // Ties every size of one shirt together, so Google shows them as one
          // product with a size selector rather than four separate listings.
          `      <g:item_group_id>${xml(p.id)}</g:item_group_id>`,
          `      <g:title>${xml(p.name)}</g:title>`,
          `      <g:description>${xml(description)}</g:description>`,
          `      <g:link>${xml(link)}</g:link>`,
          ...imageLinks,
          `      <g:availability>${available > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>`,
          '      <g:condition>new</g:condition>',
          `      <g:price>${money(onSale ? comparePaise! : pricePaise)}</g:price>`,
          ...(onSale ? [`      <g:sale_price>${money(pricePaise)}</g:sale_price>`] : []),
          `      <g:brand>${xml(BRAND.name)}</g:brand>`,
          ...(v.sku ? [`      <g:mpn>${xml(v.sku)}</g:mpn>`] : []),
          `      <g:google_product_category>${xml(googleCategory)}</g:google_product_category>`,
          ...(category ? [`      <g:product_type>${xml(category)}</g:product_type>`] : []),
          ...(v.size?.label ? [`      <g:size>${xml(v.size.label)}</g:size>`] : []),
          ...(v.color?.name ? [`      <g:color>${xml(v.color.name)}</g:color>`] : []),
          `      <g:gender>${GENDER}</g:gender>`,
          `      <g:age_group>${AGE_GROUP}</g:age_group>`,
          '    </item>',
        ].join('\n');
      });
    });

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '  <channel>',
    `    <title>${xml(BRAND.name)}</title>`,
    `    <link>${xml(base)}</link>`,
    `    <description>${xml(`${BRAND.name} product catalogue`)}</description>`,
    ...items,
    '  </channel>',
    '</rss>',
  ].join('\n');

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900, s-maxage=900',
    },
  });
}
