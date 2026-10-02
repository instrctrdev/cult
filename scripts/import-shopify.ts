/**
 * CULT catalogue importer.
 *
 * Reads CULT's public Shopify JSON endpoints. The source URL must be supplied
 * explicitly so this duplicate can never silently import another brand.
 *
 *   IMPORT_SOURCE_URL="https://your-cult-store.example" npm run import:shopify
 *   IMPORT_SOURCE_FILE="data/cult-products.json" npm run import:shopify -- --offline
 *   npm run import:shopify -- --no-images  # metadata only, images as placeholders
 *   npm run import:shopify -- --dry-run    # report what would change
 *
 * Re-running is safe: products are matched on their source handle and updated
 * in place, so prices and stock stay in sync without duplicating anything.
 */
import './load-env';
import { readFile } from 'fs/promises';
import path from 'path';
import { PrismaClient, ProductStatus, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const STORE = process.env.IMPORT_SOURCE_URL?.replace(/\/$/, '');
const SOURCE_FILE = process.env.IMPORT_SOURCE_FILE;
const COLLECTIONS_FILE = process.env.IMPORT_COLLECTIONS_FILE;
const args = process.argv.slice(2);
const OFFLINE = args.includes('--offline');
const NO_IMAGES = args.includes('--no-images');
const DRY_RUN = args.includes('--dry-run');

/**
 * Editorial pages published on the live store. Their content is fetched rather
 * than written here: policy and contact copy is legally meaningful and must
 * never be invented. A page that cannot be fetched is created empty and
 * flagged for the admin.
 */
const SOURCE_PAGES = [
  { handle: 'about-us', title: 'About Us', footer: true },
  { handle: 'contact', title: 'Contact Us', footer: true },
  { handle: 'terms-and-conditions', title: 'Terms and Conditions', footer: true },
  { handle: 'privacy-policy', title: 'Privacy Policy', footer: true },
  { handle: 'return-exchange-policy', title: 'Return & Exchange Policy', footer: true },
  { handle: 'shipping-and-delivery-policy', title: 'Shipping and Delivery Policy', footer: true },
] as const;

/**
 * Extracts the main content of a Shopify page and strips anything unsafe or
 * theme-specific. Only the article body survives — no scripts, no styles, no
 * event handlers.
 */
function extractPageContent(html: string): string | null {
  const candidates = [
    /<div[^>]*class="[^"]*rte[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/(?:main|section|article)/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
  ];

  let body: string | null = null;
  for (const re of candidates) {
    const m = html.match(re);
    if (m?.[1] && m[1].length > 200) { body = m[1]; break; }
  }
  if (!body) return null;

  const cleaned = body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\sclass\s*=\s*"[^"]*"/gi, '')
    .replace(/\sstyle\s*=\s*"[^"]*"/gi, '')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/div>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return stripHtml(cleaned).length > 80 ? cleaned : null;
}

async function importPages(warnings: string[]): Promise<{ imported: number; empty: number }> {
  let imported = 0;
  let empty = 0;

  for (const [i, page] of SOURCE_PAGES.entries()) {
    let content: string | null = null;

    if (!OFFLINE) {
      try {
        const res = await fetch(`${STORE}/pages/${page.handle}`, {
          headers: { 'User-Agent': 'CULTImporter/1.0' },
          signal: AbortSignal.timeout(20_000),
        });
        if (res.ok) content = extractPageContent(await res.text());
      } catch {
        content = null;
      }
    }

    if (!content) {
      empty++;
      warnings.push(`Page "${page.title}" could not be read from the source — created empty for the admin to fill in. Never publish invented policy text.`);
    } else {
      imported++;
    }

    if (DRY_RUN) continue;

    const existingPage = await prisma.page.findUnique({
      where: { slug: page.handle },
      select: { content: true },
    });
    const existingContent = (existingPage?.content ?? '').trim();

    await prisma.page.upsert({
      where: { slug: page.handle },
      create: {
        slug: page.handle,
        title: page.title,
        content,
        isPublished: Boolean(content),
        showInFooter: page.footer,
        position: i,
        metaTitle: `${page.title} | CULT`,
      },
      update: {
        title: page.title,
        showInFooter: page.footer,
        position: i,
        // Content an editor has written is never overwritten — but a row left
        // empty by an earlier `--offline` run must still be able to heal, so
        // content is only filled in when there is nothing there.
        ...(content && !existingContent ? { content, isPublished: true } : {}),
      },
    });
  }

  return { imported, empty };
}

// ────────────────────────────── Source types ──────────────────────────────

interface ShopifyVariant {
  id: number;
  title: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  sku: string | null;
  price: string;
  compare_at_price: string | null;
  available: boolean;
  grams: number;
}

interface ShopifyImage { id: number; src: string; position: number; alt?: string | null }

interface ShopifyProduct {
  id: number;
  handle: string;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  tags: string[];
  published_at: string;
  options: { name: string; values: string[] }[];
  variants: ShopifyVariant[];
  images: ShopifyImage[];
}

interface ShopifyCollection { handle: string; title: string; products_count: number }

// ─────────────────────────────── Helpers ─────────────────────────────────

function slugify(input: string): string {
  return (
    input
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90) || 'product'
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Colour is not a Shopify option on this store — it is expressed in the
 * product title. Matching against the seeded colour list is the only honest
 * way to recover it; unmatched products simply get no colour.
 */
const COLOR_HINTS: { slug: string; patterns: RegExp[] }[] = [
  { slug: 'light-blue', patterns: [/light\s*blue/i, /ice\s*blue/i] },
  { slug: 'black', patterns: [/\bblack\b/i] },
  { slug: 'white', patterns: [/\bwhite\b/i] },
  { slug: 'grey', patterns: [/\bgr[ae]y\b/i] },
  { slug: 'brown', patterns: [/\bbrown\b/i, /\bcocoa\b/i] },
  { slug: 'beige', patterns: [/\bbeige\b/i] },
  { slug: 'blue', patterns: [/\bblue\b/i, /\bdenim\b/i] },
  { slug: 'olive', patterns: [/\bolive\b/i] },
];

function detectColorSlug(title: string): string | null {
  for (const { slug, patterns } of COLOR_HINTS) {
    if (patterns.some((p) => p.test(title))) return slug;
  }
  return null;
}

/** Pulls "Fabric Type: Linen Blend" style rows out of the description HTML. */
function extractDetails(html: string): { details: { label: string; value: string }[]; fabric: string | null; fit: string | null } {
  const details: { label: string; value: string }[] = [];
  let fabric: string | null = null;
  let fit: string | null = null;

  const items = html.match(/<li>[\s\S]*?<\/li>/gi) ?? [];
  for (const li of items) {
    const text = stripHtml(li);
    if (!text) continue;
    const labelled = text.match(/^([^:]{2,40}):\s*(.+)$/);
    if (labelled) {
      const label = labelled[1].trim();
      const value = labelled[2].trim();
      details.push({ label, value });
      if (/fabric/i.test(label)) fabric = value;
    } else {
      details.push({ label: '', value: text });
    }
  }

  const fitMatch = stripHtml(html).match(/\b(regular|boxy|relaxed|slim|oversized)[- ]fit\b/i);
  if (fitMatch) fit = `${fitMatch[1][0].toUpperCase()}${fitMatch[1].slice(1).toLowerCase()} Fit`;

  return { details, fabric, fit };
}

/** Tag → category slug. Only maps onto collections that actually exist. */
function categorySlugsFor(product: ShopifyProduct): string[] {
  const slugs = new Set<string>();
  for (const tag of product.tags) {
    const s = slugify(tag);
    if (s && s !== 'image-swap' && s !== 'button') slugs.add(s);
  }
  return [...slugs];
}

async function loadSource(): Promise<{ products: ShopifyProduct[]; collections: ShopifyCollection[] }> {
  if (OFFLINE) {
    if (!SOURCE_FILE) throw new Error('Set IMPORT_SOURCE_FILE to a CULT catalogue JSON file before using --offline.');
    const productsPath = path.resolve(process.cwd(), SOURCE_FILE);
    const collectionsPath = COLLECTIONS_FILE ? path.resolve(process.cwd(), COLLECTIONS_FILE) : null;
    console.log(`▸ Reading offline catalogue from ${productsPath}`);
    const [p, c] = await Promise.all([
      readFile(productsPath, 'utf8'),
      collectionsPath ? readFile(collectionsPath, 'utf8').catch(() => '{"collections":[]}') : Promise.resolve('{"collections":[]}'),
    ]);
    return { products: JSON.parse(p).products, collections: JSON.parse(c).collections ?? [] };
  }

  if (!STORE) throw new Error('Set IMPORT_SOURCE_URL to CULT’s own Shopify storefront before importing.');
  console.log(`▸ Fetching public catalogue from ${STORE}`);
  const products: ShopifyProduct[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${STORE}/products.json?limit=250&page=${page}`, {
      headers: { 'User-Agent': 'CULTImporter/1.0' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`products.json returned HTTP ${res.status}`);
    const batch = (await res.json()) as { products: ShopifyProduct[] };
    if (!batch.products.length) break;
    products.push(...batch.products);
  }

  const cRes = await fetch(`${STORE}/collections.json?limit=250`, {
    headers: { 'User-Agent': 'CULTImporter/1.0' },
    signal: AbortSignal.timeout(30_000),
  });
  const collections = cRes.ok ? ((await cRes.json()) as { collections: ShopifyCollection[] }).collections : [];

  return { products, collections };
}

// ──────────────────────────────── Import ─────────────────────────────────

async function main() {
  const started = Date.now();
  const { products, collections } = await loadSource();
  console.log(`  ✓ ${products.length} products, ${collections.length} collections\n`);

  if (DRY_RUN) console.log('▸ DRY RUN — nothing will be written\n');

  // Reference data must already exist (created by the seed).
  const sizes = await prisma.size.findMany();
  const colors = await prisma.color.findMany();
  const sizeByCode = new Map(sizes.map((s) => [s.code.toUpperCase(), s]));
  const colorBySlug = new Map(colors.map((c) => [c.slug, c]));

  if (!sizes.length) {
    throw new Error('No sizes found. Run `npm run db:seed` before importing.');
  }

  // Ensure every source collection has a category.
  for (const c of collections) {
    const slug = slugify(c.handle);
    if (DRY_RUN) continue;
    await prisma.category.upsert({
      where: { slug },
      create: { slug, legacyHandle: c.handle, name: c.title.trim() || c.handle, isActive: true },
      update: { legacyHandle: c.handle },
    });
  }

  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

  const stats = { created: 0, updated: 0, variants: 0, images: 0, imagesFailed: 0, placeholders: 0, skipped: 0 };
  const warnings: string[] = [];
  const usedSlugs = new Set<string>();

  for (const src of products) {
    if (!src.variants.length) {
      warnings.push(`"${src.title}" has no variants — skipped.`);
      stats.skipped++;
      continue;
    }

    // The live store has mismatched handles (a shirt at /products/beige-shaket),
    // so the slug comes from the title and the handle is kept for redirects.
    let slug = slugify(src.title);
    if (usedSlugs.has(slug)) slug = `${slug}-${src.id.toString(36).slice(-4)}`;
    usedSlugs.add(slug);

    if (slug !== slugify(src.handle)) {
      warnings.push(`"${src.title}": live handle "${src.handle}" does not match the title; new slug "${slug}" (old URL will redirect).`);
    }

    const prices = src.variants.map((v) => Math.round(parseFloat(v.price) * 100));
    const minPrice = Math.min(...prices);
    const compareValues = src.variants
      .map((v) => (v.compare_at_price ? Math.round(parseFloat(v.compare_at_price) * 100) : 0))
      .filter((n) => n > 0);
    const maxCompare = compareValues.length ? Math.max(...compareValues) : null;

    const bodyHtml = (src.body_html ?? '').trim();
    const { details, fabric, fit } = extractDetails(bodyHtml);
    const colorSlug = detectColorSlug(src.title);
    const color = colorSlug ? colorBySlug.get(colorSlug) ?? null : null;

    const tagSlugs = categorySlugsFor(src);
    const linkedCategories = tagSlugs
      .map((s) => categoryBySlug.get(s))
      .filter((c): c is { id: string; slug: string } => Boolean(c));

    if (!linkedCategories.length) {
      warnings.push(`"${src.title}" matched no category — it will not appear under any collection.`);
    }

    const description = bodyHtml || null;
    const needsDescription = !description;
    if (needsDescription) warnings.push(`"${src.title}" has no description on the live store — flagged for the admin.`);

    if (DRY_RUN) {
      console.log(`  would import: ${src.title} → /product/${slug} (${src.variants.length} variants, ${src.images.length} images)`);
      continue;
    }

    const existing = await prisma.product.findFirst({
      where: { OR: [{ legacyHandle: src.handle }, { slug }] },
      select: { id: true },
    });

    const data = {
      slug,
      legacyHandle: src.handle,
      name: src.title.trim(),
      description,
      details: details as unknown as Prisma.InputJsonValue,
      fabric,
      fit,
      vendor: 'CULT',
      price: new Prisma.Decimal(minPrice).div(100),
      compareAtPrice: maxCompare ? new Prisma.Decimal(maxCompare).div(100) : null,
      status: ProductStatus.ACTIVE,
      publishedAt: src.published_at ? new Date(src.published_at) : new Date(),
      isNewArrival: tagSlugs.includes('new-arrivals') || tagSlugs.includes('new-launch'),
      isBestSeller: tagSlugs.includes('best-sellers'),
      needsDescription,
      metaTitle: `${src.title.trim()} | CULT`,
      metaDescription: description ? stripHtml(description).slice(0, 155) : null,
    };

    const product = existing
      ? await prisma.product.update({ where: { id: existing.id }, data })
      : await prisma.product.create({ data });

    if (existing) stats.updated++;
    else stats.created++;

    // Categories — replaced wholesale so removals on the source propagate.
    await prisma.productCategory.deleteMany({ where: { productId: product.id } });
    if (linkedCategories.length) {
      await prisma.productCategory.createMany({
        data: linkedCategories.map((c, i) => ({ productId: product.id, categoryId: c.id, position: i })),
        skipDuplicates: true,
      });
    }

    // ── Variants ──────────────────────────────────────────────────────────
    for (const [i, v] of src.variants.entries()) {
      const sizeCode = (v.option1 ?? v.title ?? '').trim().toUpperCase();
      const size = sizeByCode.get(sizeCode) ?? null;
      if (!size && sizeCode) warnings.push(`"${src.title}": unknown size "${sizeCode}" — variant stored without a size.`);

      // Source SKUs are mostly null and the few that exist collide across
      // products, so a deterministic SKU is generated from slug + size.
      const sku = `CU-${slug.toUpperCase().replace(/-/g, '').slice(0, 14)}-${sizeCode || String(i + 1)}`;

      const priceDec = new Prisma.Decimal(parseFloat(v.price)).toDecimalPlaces(2);
      const compareDec = v.compare_at_price
        ? new Prisma.Decimal(parseFloat(v.compare_at_price)).toDecimalPlaces(2)
        : null;

      const existingVariant = await prisma.productVariant.findFirst({
        where: { productId: product.id, sizeId: size?.id ?? null, colorId: color?.id ?? null },
        select: { id: true },
      });

      const variant = existingVariant
        ? await prisma.productVariant.update({
            where: { id: existingVariant.id },
            data: { sku, price: priceDec, compareAtPrice: compareDec, weightGrams: v.grams || 300, position: i, isActive: true },
          })
        : await prisma.productVariant.create({
            data: {
              productId: product.id,
              sizeId: size?.id ?? null,
              colorId: color?.id ?? null,
              sku,
              price: priceDec,
              compareAtPrice: compareDec,
              weightGrams: v.grams || 300,
              position: i,
            },
          });

      // The public JSON exposes availability as a boolean, never a count.
      // Seeding a real number would be inventing data, so out-of-stock maps to
      // 0 and in-stock maps to 0 with the admin prompted to set real counts.
      const inventory = await prisma.inventory.findUnique({ where: { variantId: variant.id } });
      if (!inventory) {
        await prisma.inventory.create({
          data: { variantId: variant.id, quantity: v.available ? 1 : 0, lowStockThreshold: 3 },
        });
        if (v.available) {
          warnings.push(`"${src.title}" (${sizeCode}): source exposes availability only, not counts — stock set to 1. Set real quantities in Admin → Inventory.`);
        }
      }
      stats.variants++;
    }

    // ── Images ────────────────────────────────────────────────────────────
    const existingImages = await prisma.productImage.count({ where: { productId: product.id } });

    if (existingImages === 0) {
      if (!src.images.length) {
        await prisma.productImage.create({
          data: {
            productId: product.id,
            url: '',
            alt: `${src.title} — image pending upload`,
            position: 0,
            isPlaceholder: true,
          },
        });
        await prisma.product.update({ where: { id: product.id }, data: { needsImagery: true } });
        stats.placeholders++;
        warnings.push(`"${src.title}" has no images on the source — placeholder created for manual upload.`);
      } else {
        for (const [i, img] of src.images.entries()) {
          let stored: { url: string; width: number; height: number; blurDataUrl: string } | null = null;

          if (!NO_IMAGES) {
            try {
              const { storeImageFromUrl } = await import('../src/lib/image-store');
              stored = await storeImageFromUrl(img.src, { folder: 'products', baseName: `${slug}-${i + 1}` });
            } catch (err) {
              stats.imagesFailed++;
              warnings.push(`"${src.title}" image ${i + 1} could not be downloaded (${err instanceof Error ? err.message : 'unknown'}) — placeholder created.`);
            }
          }

          await prisma.productImage.create({
            data: {
              productId: product.id,
              url: stored?.url ?? '',
              blurDataUrl: stored?.blurDataUrl ?? null,
              width: stored?.width ?? null,
              height: stored?.height ?? null,
              alt: img.alt?.trim() || `${src.title} — view ${i + 1}`,
              position: i,
              colorId: color?.id ?? null,
              // The source store's files are named ChatGPTImage*.png — they are
              // AI-generated. Flagged so the admin can replace them with real
              // photography; this project never generates imagery itself.
              aiGenerated: /chatgpt/i.test(img.src),
              isPlaceholder: !stored,
            },
          });

          if (stored) stats.images++;
          else stats.placeholders++;
        }

        const anyReal = await prisma.productImage.count({ where: { productId: product.id, isPlaceholder: false } });
        if (anyReal === 0) {
          await prisma.product.update({ where: { id: product.id }, data: { needsImagery: true } });
        }
      }
    }
  }

  // ── Editorial pages ─────────────────────────────────────────────────────
  const pageStats = await importPages(warnings);

  // ── Report ──────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────');
  console.log(` Products created ......... ${stats.created}`);
  console.log(` Products updated ......... ${stats.updated}`);
  console.log(` Products skipped ......... ${stats.skipped}`);
  console.log(` Variants ................. ${stats.variants}`);
  console.log(` Images downloaded ........ ${stats.images}`);
  console.log(` Image placeholders ....... ${stats.placeholders}`);
  console.log(` Image download failures .. ${stats.imagesFailed}`);
  console.log(` Pages imported ........... ${pageStats.imported}`);
  console.log(` Pages needing content .... ${pageStats.empty}`);
  console.log(`─────────────────────────────────────────`);

  if (warnings.length) {
    console.log(`\n⚠ ${warnings.length} item(s) need attention in the admin panel:\n`);
    for (const w of warnings) console.log(`   • ${w}`);
  }

  console.log(`\n✅ Import finished in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  if (!DRY_RUN) {
    console.log('   Next: set real stock counts in Admin → Inventory,');
    console.log('   and review flagged products in Admin → Products.\n');
  }
}

main()
  .catch((e) => {
    console.error('\n❌ Import failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
