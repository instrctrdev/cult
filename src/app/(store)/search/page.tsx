import type { Metadata } from 'next';
import { ProductService } from '@/services/product.service';
import { SearchService } from '@/services/search.service';
import { productQuerySchema } from '@/lib/validation';
import { ListingPage } from '@/components/shop/listing-page';
import { NoResultsState } from '@/components/ui/states';
import { SearchTracker } from '@/components/shop/search-tracker';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const raw = await searchParams;
  const q = typeof raw.q === 'string' ? raw.q : '';
  return {
    title: q ? `Search: ${q}` : 'Search',
    // Search result pages should never be indexed.
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v != null),
  ) as Record<string, string>;

  const parsed = productQuerySchema.safeParse(flat);
  const q = parsed.success ? parsed.data : productQuerySchema.parse({});
  const term = q.q?.trim() ?? '';

  if (!term) {
    return (
      <div className="container py-16">
        <h1 className="mb-2 text-3xl">Search</h1>
        <NoResultsState />
      </div>
    );
  }

  const listing = await ProductService.list({
    search: term,
    sizeCodes: q.size?.split(',').filter(Boolean),
    colorSlugs: q.color?.split(',').filter(Boolean),
    collection: q.collection,
    categorySlugs: q.category?.split(',').filter(Boolean),
    minPricePaise: q.minPrice != null ? q.minPrice * 100 : undefined,
    maxPricePaise: q.maxPrice != null ? q.maxPrice * 100 : undefined,
    inStockOnly: Boolean(q.inStock),
    onSaleOnly: Boolean(q.onSale),
    sort: q.sort,
    page: 1,
    perPage: q.perPage,
  });

  void SearchService.log(term, listing.total);

  return (
    <>
      <SearchTracker term={term} results={listing.total} />
      <ListingPage
        title={`“${term}”`}
        description={`${listing.total} ${listing.total === 1 ? 'result' : 'results'}`}
        listing={listing}
        breadcrumbs={[{ name: 'Home', href: '/' }, { name: 'Search', href: '/search' }]}
        listName={`Search: ${term}`}
      />
    </>
  );
}
