import 'server-only';
import { prisma } from '@/lib/prisma';
import { ProductService } from './product.service';
import type { ProductCardDTO } from '@/types';

export interface SearchSuggestions {
  products: ProductCardDTO[];
  categories: { slug: string; name: string }[];
  /** Popular terms with results, derived from real logged searches. */
  popular: string[];
  total: number;
}

/**
 * Search runs entirely server-side; the client only ever sends a term string
 * and receives shaped DTOs. No query is ever built from raw client SQL.
 */
export const SearchService = {
  async suggest(term: string, limit = 6): Promise<SearchSuggestions> {
    const q = term.trim().slice(0, 100);
    if (q.length < 2) {
      return { products: [], categories: [], popular: await this.popularTerms(), total: 0 };
    }

    const [listing, categories] = await Promise.all([
      ProductService.list({ search: q, perPage: limit, sort: 'featured' }),
      prisma.category.findMany({
        where: { isActive: true, deletedAt: null, name: { contains: q } },
        select: { slug: true, name: true },
        take: 4,
      }),
    ]);

    return {
      products: listing.products,
      categories,
      popular: [],
      total: listing.total,
    };
  },

  /** Logged asynchronously so search latency is never affected. */
  async log(term: string, results: number, userId?: string | null): Promise<void> {
    const q = term.trim().slice(0, 190);
    if (q.length < 2) return;
    await prisma.searchQuery
      .create({ data: { term: q.toLowerCase(), results, userId: userId ?? null } })
      .catch(() => undefined);
  },

  /** Real terms customers used that returned results — never invented. */
  async popularTerms(limit = 6): Promise<string[]> {
    const rows = await prisma.searchQuery.groupBy({
      by: ['term'],
      where: { results: { gt: 0 }, createdAt: { gte: new Date(Date.now() - 30 * 864e5) } },
      _count: { term: true },
      orderBy: { _count: { term: 'desc' } },
      take: limit,
    });
    return rows.map((r) => r.term);
  },
};
