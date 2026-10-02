'use client';

import * as React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ProductGridSkeleton } from '@/components/ui/skeleton';
import { NoResultsState, ErrorState } from '@/components/ui/states';
import { ProductGrid } from '@/components/product/product-grid';
import { track } from '@/lib/analytics';
import { useFilters } from './filter-state';
import type { ProductListResult } from '@/types';

/**
 * Client listing with "load more" plus an intersection-observer auto-load.
 *
 * The first page is passed in from the server so the grid is present in the
 * initial HTML (good for SEO and first paint); subsequent pages are fetched.
 * A "Load more" button always exists as the accessible fallback — infinite
 * scroll alone is a keyboard trap.
 */
export function ProductListing({
  initialData,
  listName,
}: {
  initialData: ProductListResult;
  listName: string;
}) {
  const searchParams = useSearchParams();
  const { clearAll } = useFilters();
  const queryString = searchParams.toString();
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } =
    useInfiniteQuery({
      queryKey: ['products', queryString],
      initialPageParam: 1,
      queryFn: async ({ pageParam }) => {
        const sp = new URLSearchParams(queryString);
        sp.set('page', String(pageParam));
        const res = await fetch(`/api/products?${sp.toString()}`);
        if (!res.ok) throw new Error('Could not load products.');
        return (await res.json()) as ProductListResult;
      },
      // Page 1 is already rendered server-side; reuse it instead of refetching.
      initialData: { pages: [initialData], pageParams: [1] },
      getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    });

  const products = React.useMemo(() => data?.pages.flatMap((p) => p.products) ?? [], [data]);
  const total = data?.pages[0]?.total ?? 0;

  React.useEffect(() => {
    if (products.length > 0) {
      track({
        name: 'view_item_list',
        listName,
        items: products.slice(0, 12).map((p) => ({ id: p.id, name: p.name, price: p.pricePaise / 100 })),
      });
    }
    // Deliberately keyed on the result-set size rather than the array: this is
    // a "list viewed" analytics event, and re-firing it on every render (or on
    // every identity change of `products`) would inflate the metric.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listName, products.length]);

  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (isLoading && products.length === 0) return <ProductGridSkeleton />;
  if (products.length === 0) return <NoResultsState onClear={clearAll} />;

  return (
    <div>
      <ProductGrid products={products} />

      <div ref={sentinelRef} aria-hidden className="h-px" />

      <div className="mt-12 flex flex-col items-center gap-3">
        <p className="text-xs text-muted" role="status" aria-live="polite">
          Showing {products.length} of {total}
        </p>
        {hasNextPage && (
          <Button variant="outline" size="lg" loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>
            Load more
          </Button>
        )}
      </div>
    </div>
  );
}
