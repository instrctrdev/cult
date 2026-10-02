'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { FilterPanel, ActiveFilterChips } from './filter-panel';
import { ListingToolbar, SortSelect } from './listing-toolbar';
import { ProductListing } from './product-listing';
import type { ProductListResult } from '@/types';

/**
 * Shared listing shell for /shop, /category/[slug] and /search.
 *
 * Desktop gets a sticky sidebar; mobile gets the sheet-based toolbar. One
 * component so the three pages cannot diverge in behaviour.
 */
export function ListingPage({
  title,
  description,
  listing,
  breadcrumbs,
  listName,
  showCategoryFilter = true,
}: {
  title: string;
  description?: string;
  listing: ProductListResult;
  breadcrumbs: { name: string; href: string }[];
  listName: string;
  showCategoryFilter?: boolean;
}) {
  return (
    <div className="container py-4 lg:py-6">
      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="flex flex-wrap items-center gap-1 text-2xs uppercase tracking-wide2 text-muted">
          {breadcrumbs.map((crumb, i) => (
            <li key={crumb.href} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-faint" aria-hidden />}
              {i === breadcrumbs.length - 1 ? (
                <span aria-current="page" className="text-ink">{crumb.name}</span>
              ) : (
                <Link href={crumb.href} className="hover:text-ink hover:underline">{crumb.name}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/*
       * Title, count and eyebrow are visually hidden on every listing page —
       * the breadcrumb right above already says where you are (Shop, or
       * Shop > Fresh Arrivals), so repeating it as a heading was just extra
       * height with nothing new to say. The h1 stays in the markup (sr-only)
       * rather than disappearing outright, since the page still needs one
       * for screen readers and SEO.
       */}
      <header className="mb-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="sr-only">
            <h1 className="text-3xl md:text-4xl">{title}</h1>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <SortSelect />
        </div>
      </header>

      <ListingToolbar facets={listing.facets} total={listing.total} showCategories={showCategoryFilter} />

      <div className="mt-5 hidden lg:mt-0 lg:block">
        <ActiveFilterChips facets={listing.facets} />
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[240px_1fr] lg:gap-10">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-[calc(var(--header-h)+1.5rem)] max-h-[calc(100dvh-var(--header-h)-3rem)] overflow-y-auto pr-2">
            <FilterPanel facets={listing.facets} showCategories={showCategoryFilter} />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-5 lg:hidden">
            <ActiveFilterChips facets={listing.facets} />
          </div>
          <ProductListing initialData={listing} listName={listName} />
        </div>
      </div>

    </div>
  );
}
