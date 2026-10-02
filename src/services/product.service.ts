import 'server-only';
import { Prisma, ProductStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { toPaise } from '@/lib/money';
import { stripHtml, truncate } from '@/lib/utils';
import type {
  ProductCardDTO, ProductDetailDTO, ProductFilters, ProductImageDTO,
  ProductListResult, SortOption, VariantDTO,
} from '@/types';

const PLACEHOLDER_IMAGE = '/images/placeholder-product.svg';

/**
 * Only published, non-deleted products are ever visible on the storefront.
 *
 * A function, not a constant: `new Date()` in a module-level object is
 * evaluated once when the module is first imported, freezing "now" at the
 * moment the server booted. Every product published after that compared as
 * scheduled-for-the-future and vanished from the storefront while looking
 * perfectly fine in admin — until the process happened to restart.
 */
function publicWhere(): Prisma.ProductWhereInput {
  return {
    status: ProductStatus.ACTIVE,
    deletedAt: null,
    publishedAt: { not: null, lte: new Date() },
  };
}

const cardSelect = {
  id: true,
  slug: true,
  name: true,
  price: true,
  compareAtPrice: true,
  isNewArrival: true,
  isBestSeller: true,
  isFeatured: true,
  position: true,
  createdAt: true,
  images: {
    orderBy: { position: 'asc' },
    // Enough for a card's own scrollable gallery, matching the PDP, without
    // pulling a product's entire shoot into every listing page's payload.
    take: 5,
    select: {
      id: true, url: true, alt: true, width: true, height: true,
      blurDataUrl: true, isPlaceholder: true, colorId: true,
    },
  },
  variants: {
    where: { isActive: true, deletedAt: null },
    orderBy: { position: 'asc' },
    select: {
      id: true, sku: true, price: true, compareAtPrice: true,
      size: { select: { id: true, code: true, label: true, position: true } },
      color: { select: { id: true, slug: true, name: true, hex: true } },
      inventory: { select: { quantity: true, reserved: true, lowStockThreshold: true, allowBackorder: true } },
    },
  },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

function mapImage(img: CardRow['images'][number] | undefined, productName: string): ProductImageDTO | null {
  if (!img) return null;
  return {
    id: img.id,
    url: img.isPlaceholder || !img.url ? PLACEHOLDER_IMAGE : img.url,
    alt: img.alt || productName,
    width: img.width,
    height: img.height,
    blurDataUrl: img.blurDataUrl,
    isPlaceholder: img.isPlaceholder,
    colorId: img.colorId,
  };
}

function availabilityOf(v: CardRow['variants'][number]): number {
  const inv = v.inventory;
  if (!inv) return 0;
  if (inv.allowBackorder) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, inv.quantity - inv.reserved);
}

export function toProductCard(row: CardRow): ProductCardDTO {
  const pricePaise = toPaise(row.price);
  const compareAtPaise = row.compareAtPrice ? toPaise(row.compareAtPrice) : null;

  // Only offer a size/colour on the card if at least one variant of it can be bought.
  const buyable = row.variants.filter((v) => availabilityOf(v) > 0);

  const sizeMap = new Map<string, { id: string; code: string; label: string; position: number }>();
  const colorMap = new Map<string, { id: string; slug: string; name: string; hex: string }>();
  for (const v of buyable) {
    if (v.size) sizeMap.set(v.size.id, v.size);
    if (v.color) colorMap.set(v.color.id, v.color);
  }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    image: mapImage(row.images[0], row.name),
    hoverImage: mapImage(row.images[1], row.name),
    images: row.images.map((i) => mapImage(i, row.name)).filter((i): i is ProductImageDTO => i !== null),
    pricePaise,
    compareAtPaise,
    discountPercent:
      compareAtPaise && compareAtPaise > pricePaise
        ? Math.round(((compareAtPaise - pricePaise) / compareAtPaise) * 100)
        : null,
    inStock: buyable.length > 0,
    sizes: [...sizeMap.values()]
      .sort((a, b) => a.position - b.position)
      .map(({ id, code, label }) => ({ id, code, label })),
    colors: [...colorMap.values()],
    isNewArrival: row.isNewArrival,
    isBestSeller: row.isBestSeller,
  };
}

function orderByFor(sort: SortOption = 'featured'): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'newest':
      return [{ publishedAt: 'desc' }, { createdAt: 'desc' }];
    case 'price-asc':
      return [{ price: 'asc' }, { name: 'asc' }];
    case 'price-desc':
      return [{ price: 'desc' }, { name: 'asc' }];
    case 'name-asc':
      return [{ name: 'asc' }];
    case 'discount':
      // MySQL cannot order by a computed ratio through Prisma; the closest
      // proxy is the largest compare-at price. Re-sorted precisely below.
      return [{ compareAtPrice: 'desc' }];
    case 'featured':
    default:
      return [{ isFeatured: 'desc' }, { position: 'asc' }, { publishedAt: 'desc' }];
  }
}

function buildWhere(filters: ProductFilters): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [publicWhere()];

  // Curated collections are product flags rather than categories, so the
  // homepage's "Fresh Arrivals" links to exactly what the rails show.
  if (filters.collection === 'fresh-arrivals') and.push({ isNewArrival: true });
  if (filters.collection === 'best-sellers') and.push({ isBestSeller: true });
  if (filters.collection === 'featured') and.push({ isFeatured: true });
  if (filters.collection === 'sale') and.push({ compareAtPrice: { not: null } });

  if (filters.categorySlugs?.length) {
    and.push({ categories: { some: { category: { slug: { in: filters.categorySlugs }, isActive: true } } } });
  }
  if (filters.sizeCodes?.length) {
    and.push({ variants: { some: { isActive: true, deletedAt: null, size: { code: { in: filters.sizeCodes } } } } });
  }
  if (filters.colorSlugs?.length) {
    and.push({ variants: { some: { isActive: true, deletedAt: null, color: { slug: { in: filters.colorSlugs } } } } });
  }
  if (filters.minPricePaise != null) and.push({ price: { gte: filters.minPricePaise / 100 } });
  if (filters.maxPricePaise != null) and.push({ price: { lte: filters.maxPricePaise / 100 } });

  if (filters.onSaleOnly) {
    // Prisma cannot compare two columns here; compareAtPrice being set is the
    // store's own definition of "on sale", and the importer keeps it truthful.
    and.push({ compareAtPrice: { not: null } });
  }
  if (filters.inStockOnly) {
    and.push({
      variants: { some: { isActive: true, deletedAt: null, inventory: { is: { quantity: { gt: 0 } } } } },
    });
  }
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    and.push({
      OR: [
        { name: { contains: q } },
        { description: { contains: q } },
        { categories: { some: { category: { name: { contains: q } } } } },
      ],
    });
  }

  return { AND: and };
}

export const ProductService = {
  /**
   * Faceted, paginated listing. Facet counts are computed against the same
   * filter set so the sidebar never offers a combination that yields zero.
   */
  async list(filters: ProductFilters = {}): Promise<ProductListResult> {
    const page = Math.max(1, filters.page ?? 1);
    const perPage = Math.min(60, Math.max(1, filters.perPage ?? 12));
    const where = buildWhere(filters);

    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        select: cardSelect,
        orderBy: orderByFor(filters.sort),
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    let products = rows.map(toProductCard);
    if (filters.sort === 'discount') {
      products = products.sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0));
    }

    return {
      products,
      total,
      page,
      perPage,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
      facets: await this.facets(filters),
    };
  },

  /**
   * Facet counts. Size/colour facets deliberately ignore the corresponding
   * active filter so a customer can widen a selection without clearing it.
   */
  async facets(filters: ProductFilters = {}): Promise<ProductListResult['facets']> {
    const baseNoSize = buildWhere({ ...filters, sizeCodes: undefined });
    const baseNoColor = buildWhere({ ...filters, colorSlugs: undefined });
    const baseNoCategory = buildWhere({ ...filters, categorySlugs: undefined });
    const base = buildWhere(filters);

    /**
     * Facet counts are *product* counts, never variant counts — a shirt in four
     * sizes must read as one result, not four. Grouping by (attribute, product)
     * yields one row per distinct product, so counting rows gives that directly.
     */
    const [sizes, colors, categories, priceAgg, sizePairs, colorPairs] = await Promise.all([
      prisma.size.findMany({ orderBy: { position: 'asc' }, select: { id: true, code: true, label: true } }),
      prisma.color.findMany({ orderBy: { position: 'asc' }, select: { id: true, slug: true, name: true, hex: true } }),
      prisma.category.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: { position: 'asc' },
        select: {
          id: true, slug: true, name: true,
          _count: { select: { products: { where: { product: baseNoCategory } } } },
        },
      }),
      prisma.product.aggregate({ where: base, _min: { price: true }, _max: { price: true } }),
      prisma.productVariant.groupBy({
        by: ['sizeId', 'productId'],
        where: { isActive: true, deletedAt: null, sizeId: { not: null }, product: baseNoSize },
      }),
      prisma.productVariant.groupBy({
        by: ['colorId', 'productId'],
        where: { isActive: true, deletedAt: null, colorId: { not: null }, product: baseNoColor },
      }),
    ]);

    const tally = <K extends string>(rows: { [P in K]: string | null }[], key: K) => {
      const counts = new Map<string, number>();
      for (const row of rows) {
        const id = row[key];
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      return counts;
    };

    const sizeCounts = tally(sizePairs, 'sizeId');
    const colorCounts = tally(colorPairs, 'colorId');

    return {
      sizes: sizes
        .map((s) => ({ value: s.code, label: s.label, count: sizeCounts.get(s.id) ?? 0 }))
        .filter((s) => s.count > 0),
      colors: colors
        .map((c) => ({ value: c.slug, label: c.name, count: colorCounts.get(c.id) ?? 0, meta: { hex: c.hex } }))
        .filter((c) => c.count > 0),
      categories: categories
        .filter((c) => c._count.products > 0)
        .map((c) => ({ value: c.slug, label: c.name, count: c._count.products })),
      priceRangePaise: {
        min: priceAgg._min.price ? toPaise(priceAgg._min.price) : 0,
        max: priceAgg._max.price ? toPaise(priceAgg._max.price) : 0,
      },
    };
  },

  /** Full PDP payload. Returns null for unpublished or deleted products. */
  async getBySlug(slug: string): Promise<ProductDetailDTO | null> {
    const row = await prisma.product.findFirst({
      where: { ...publicWhere(), slug },
      select: {
        ...cardSelect,
        subtitle: true,
        description: true,
        details: true,
        fabric: true,
        fit: true,
        sizeChartImage: true,
        metaTitle: true,
        metaDescription: true,
        updatedAt: true,
        images: {
          orderBy: { position: 'asc' },
          select: {
            id: true, url: true, alt: true, width: true, height: true,
            blurDataUrl: true, isPlaceholder: true, colorId: true,
          },
        },
        videos: {
          orderBy: { position: 'asc' },
          select: { id: true, url: true, posterUrl: true, alt: true },
        },
        categories: {
          orderBy: { position: 'asc' },
          select: { category: { select: { id: true, slug: true, name: true } } },
        },
        reviews: { where: { isApproved: true, deletedAt: null }, select: { rating: true } },
      },
    });
    if (!row) return null;

    const card = toProductCard(row as unknown as CardRow);

    const variants: VariantDTO[] = row.variants.map((v) => {
      const available = availabilityOf(v as CardRow['variants'][number]);
      const finite = available === Number.MAX_SAFE_INTEGER ? 99 : available;
      return {
        id: v.id,
        sku: v.sku,
        size: v.size ? { id: v.size.id, code: v.size.code, label: v.size.label } : null,
        color: v.color,
        pricePaise: toPaise(v.price),
        compareAtPaise: v.compareAtPrice ? toPaise(v.compareAtPrice) : null,
        available: finite,
        inStock: available > 0,
        isLowStock: available > 0 && finite <= (v.inventory?.lowStockThreshold ?? 3),
      };
    });

    const ratings = row.reviews.map((r) => r.rating);
    const details = Array.isArray(row.details)
      ? (row.details as { label: string; value: string }[])
      : [];

    return {
      ...card,
      images: row.images.map((i) => mapImage(i, row.name)!).filter(Boolean),
      videos: row.videos.map((v) => ({
        id: v.id,
        url: v.url,
        posterUrl: v.posterUrl,
        alt: v.alt || row.name,
      })),
      subtitle: row.subtitle,
      description: row.description,
      details,
      fabric: row.fabric,
      fit: row.fit,
      sizeChartImage: row.sizeChartImage,
      variants,
      categories: row.categories.map((c) => c.category),
      metaTitle: row.metaTitle,
      metaDescription:
        row.metaDescription ??
        (row.description ? truncate(stripHtml(row.description), 155) : null),
      rating: ratings.length
        ? { average: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10, count: ratings.length }
        : null,
      updatedAt: row.updatedAt.toISOString(),
    };
  },

  /** Products sharing a category, excluding the current one. */
  async related(productId: string, limit = 8): Promise<ProductCardDTO[]> {
    const cats = await prisma.productCategory.findMany({
      where: { productId },
      select: { categoryId: true },
    });
    const categoryIds = cats.map((c) => c.categoryId);

    const rows = await prisma.product.findMany({
      where: {
        ...publicWhere(),
        id: { not: productId },
        ...(categoryIds.length ? { categories: { some: { categoryId: { in: categoryIds } } } } : {}),
      },
      select: cardSelect,
      orderBy: [{ isBestSeller: 'desc' }, { position: 'asc' }],
      take: limit,
    });
    return rows.map(toProductCard);
  },

  /** Curated home-page rails. One query shape, three flags. */
  async byFlag(flag: 'featured' | 'new' | 'bestseller' | 'sale', limit = 8): Promise<ProductCardDTO[]> {
    const where: Prisma.ProductWhereInput = { ...publicWhere() };
    if (flag === 'featured') where.isFeatured = true;
    if (flag === 'new') where.isNewArrival = true;
    if (flag === 'bestseller') where.isBestSeller = true;
    if (flag === 'sale') where.compareAtPrice = { not: null };

    const rows = await prisma.product.findMany({
      where,
      select: cardSelect,
      orderBy: flag === 'new' ? [{ publishedAt: 'desc' }] : [{ position: 'asc' }, { publishedAt: 'desc' }],
      take: limit,
    });

    const cards = rows.map(toProductCard);
    return flag === 'sale'
      ? cards.sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0))
      : cards;
  },

  /** Fetch several cards by id, order preserved — used by "recently viewed". */
  async byIds(ids: string[]): Promise<ProductCardDTO[]> {
    if (!ids.length) return [];
    const rows = await prisma.product.findMany({
      where: { ...publicWhere(), id: { in: ids } },
      select: cardSelect,
    });
    const byId = new Map(rows.map((r) => [r.id, toProductCard(r)]));
    return ids.map((id) => byId.get(id)).filter((p): p is ProductCardDTO => Boolean(p));
  },

  /** Every published slug, for the sitemap. */
  async allSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return prisma.product.findMany({
      where: publicWhere(),
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
  },

  /** Resolves an old Shopify handle to the current slug so legacy URLs can 301. */
  async slugForLegacyHandle(handle: string): Promise<string | null> {
    const row = await prisma.product.findFirst({
      where: { legacyHandle: handle, deletedAt: null },
      select: { slug: true },
    });
    return row?.slug ?? null;
  },
};
