import 'server-only';
import { prisma } from '@/lib/prisma';
import type { CategoryDTO } from '@/types';

const activeProductFilter = {
  product: { status: 'ACTIVE' as const, deletedAt: null, publishedAt: { not: null } },
};

export const CategoryService = {
  /** Categories with at least one live product, for nav and the category rail. */
  async listVisible(): Promise<CategoryDTO[]> {
    const rows = await prisma.category.findMany({
      where: { isActive: true, deletedAt: null, parentId: null },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: {
        id: true, slug: true, name: true, description: true, imageUrl: true,
        _count: { select: { products: { where: activeProductFilter } } },
        children: {
          where: { isActive: true, deletedAt: null },
          orderBy: [{ position: 'asc' }, { name: 'asc' }],
          select: {
            id: true, slug: true, name: true, description: true, imageUrl: true,
            _count: { select: { products: { where: activeProductFilter } } },
          },
        },
      },
    });

    return rows
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        imageUrl: c.imageUrl,
        productCount: c._count.products,
        children: c.children
          .filter((ch) => ch._count.products > 0)
          .map((ch) => ({
            id: ch.id, slug: ch.slug, name: ch.name,
            description: ch.description, imageUrl: ch.imageUrl,
            productCount: ch._count.products,
          })),
      }))
      .filter((c) => c.productCount > 0 || (c.children?.length ?? 0) > 0);
  },

  /**
   * Categories eligible for the header, regardless of stock.
   *
   * `listVisible()` deliberately hides empty collections, but the header is
   * different: if a homepage campaign band promotes Jackets, the header has to
   * be able to reach Jackets even before the first one is merchandised.
   */
  async navCandidates(): Promise<CategoryDTO[]> {
    const rows = await prisma.category.findMany({
      where: { isActive: true, deletedAt: null, showInNav: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: {
        id: true, slug: true, name: true, description: true, imageUrl: true,
        _count: { select: { products: { where: activeProductFilter } } },
      },
    });

    return rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      imageUrl: c.imageUrl,
      productCount: c._count.products,
    }));
  },

  async getBySlug(slug: string): Promise<CategoryDTO | null> {
    const c = await prisma.category.findFirst({
      where: { slug, isActive: true, deletedAt: null },
      select: {
        id: true, slug: true, name: true, description: true, imageUrl: true,
        metaTitle: true, metaDescription: true,
        _count: { select: { products: { where: activeProductFilter } } },
      },
    });
    if (!c) return null;
    return {
      id: c.id, slug: c.slug, name: c.name,
      description: c.description, imageUrl: c.imageUrl,
      productCount: c._count.products,
    };
  },

  async allSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return prisma.category.findMany({
      where: { isActive: true, deletedAt: null },
      select: { slug: true, updatedAt: true },
    });
  },
};
