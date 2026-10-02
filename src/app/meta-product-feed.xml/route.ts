import { NextResponse } from 'next/server';
import { ProductStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { publicEnv } from '@/lib/env';
import { toPaise, toRupees } from '@/lib/money';
import { stripHtml } from '@/lib/utils';
import { BRAND } from '@/lib/brand';

export const dynamic = 'force-dynamic';

/** Meta re-fetches on a schedule, so an hour of edge caching costs nothing and spares the database. */
export const revalidate = 0;

const MAX_DESCRIPTION = 5000;
const MAX_ADDITIONAL_IMAGES = 10;

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
 * GET /meta-product-feed.xml — the product feed Meta Commerce Manager reads.
 *
 * RSS 2.0 with Google's namespace, which is the format Meta documents for
 * catalogue ads. Generated from live data on every fetch, so a price change or
 * a size selling out reaches the catalogue on Meta's next scheduled pull
 * rather than needing anyone to re-upload a spreadsheet.
 *
 * One entry per product, not per size. Meta only needs to know whether the
 * product can be bought, and a shopper who clicks lands on the page where they
 * pick a size — listing every variant would put four near-identical entries in
 * the catalogue for one shirt.
 *
 * Availability is computed from real stock: a product whose every size has run
 * out is published as `out of stock`, so Meta stops spending on something
 * nobody can buy. That is the single most valuable thing this feed does.
 *
 * Deliberately public and unauthenticated — Meta fetches it anonymously. It
 * exposes only what the storefront already shows.
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
      categories: {
        select: { category: { select: { name: true } } },
      },
      variants: {
        where: { isActive: true, deletedAt: null },
        select: {
          inventory: { select: { quantity: true, reserved: true } },
          color: { select: { name: true } },
        },
      },
    },
  });

  const items = products
    // A product with no photograph cannot be advertised; Meta rejects the entry
    // rather than showing a blank tile.
    .filter((p) => p.images.length > 0)
    .map((p) => {
      const available = p.variants.reduce(
        (sum, v) => sum + Math.max(0, (v.inventory?.quantity ?? 0) - (v.inventory?.reserved ?? 0)),
        0,
      );

      const pricePaise = toPaise(p.price);
      const comparePaise = p.compareAtPrice ? toPaise(p.compareAtPrice) : null;
      // Meta reads `price` as the list price and `sale_price` as what is being
      // charged, so a discounted product has to send both or the saving is
      // invisible in the ad.
      const onSale = comparePaise !== null && comparePaise > pricePaise;

      const description =
        stripHtml(p.description ?? '').slice(0, MAX_DESCRIPTION) || `${p.name} by ${BRAND.name}.`;

      const colour = p.variants.find((v) => v.color?.name)?.color?.name ?? null;
      const category = p.categories[0]?.category.name ?? null;

      const money = (paise: number) => `${toRupees(paise).toFixed(2)} INR`;

      return [
        '    <item>',
        `      <g:id>${xml(p.id)}</g:id>`,
        `      <g:title>${xml(p.name)}</g:title>`,
        `      <g:description>${xml(description)}</g:description>`,
        `      <g:link>${xml(`${base}/product/${p.slug}`)}</g:link>`,
        `      <g:image_link>${xml(`${base}${p.images[0].url}`)}</g:image_link>`,
        ...p.images
          .slice(1, 1 + MAX_ADDITIONAL_IMAGES)
          .map((i) => `      <g:additional_image_link>${xml(`${base}${i.url}`)}</g:additional_image_link>`),
        `      <g:availability>${available > 0 ? 'in stock' : 'out of stock'}</g:availability>`,
        '      <g:condition>new</g:condition>',
        `      <g:price>${money(onSale ? comparePaise! : pricePaise)}</g:price>`,
        ...(onSale ? [`      <g:sale_price>${money(pricePaise)}</g:sale_price>`] : []),
        `      <g:brand>${xml(BRAND.name)}</g:brand>`,
        ...(category ? [`      <g:product_type>${xml(category)}</g:product_type>`] : []),
        ...(colour ? [`      <g:color>${xml(colour)}</g:color>`] : []),
        // Lets Meta hold back delivery as stock runs down rather than
        // advertising the last unit to thousands of people.
        `      <g:quantity_to_sell_on_facebook>${available}</g:quantity_to_sell_on_facebook>`,
        '    </item>',
      ].join('\n');
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
      // Meta pulls on its own schedule; a short cache absorbs repeat fetches
      // without letting stock go stale.
      'Cache-Control': 'public, max-age=900, s-maxage=900',
    },
  });
}
