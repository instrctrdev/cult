'use client';

import * as React from 'react';
import { ArrowUpDown, SlidersHorizontal } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { FilterPanel } from './filter-panel';
import { SORT_LABELS, useFilters } from './filter-state';
import type { ProductListResult, SortOption } from '@/types';

/**
 * Mobile filter/sort bar.
 *
 * Both controls open bottom sheets, which is the pattern a native shopping app
 * uses — the customer never leaves the results while adjusting them. Sticks
 * under the header so it stays reachable while scrolling a long grid.
 */
export function ListingToolbar({
  facets,
  total,
  showCategories = true,
}: {
  facets: ProductListResult['facets'];
  total: number;
  showCategories?: boolean;
}) {
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [sortOpen, setSortOpen] = React.useState(false);
  const { filters, apply, activeCount } = useFilters();

  return (
    <>
      <div className="sticky top-[var(--header-h)] z-30 -mx-4 border-y border-line bg-bg/95 backdrop-blur-md sm:-mx-6 lg:hidden">
        <div className="grid grid-cols-2 divide-x divide-line">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="flex h-12 items-center justify-center gap-2 text-xs font-medium uppercase tracking-wide2 text-ink"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filter
            {activeCount > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[10px] text-bg">
                {activeCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSortOpen(true)}
            className="flex h-12 items-center justify-center gap-2 text-xs font-medium uppercase tracking-wide2 text-ink"
          >
            <ArrowUpDown className="h-4 w-4" aria-hidden />
            Sort
          </button>
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          side="bottom"
          title="Filter"
          description={`${total} product${total === 1 ? '' : 's'}`}
        >
          <FilterPanel facets={facets} showCategories={showCategories} onApplied={() => setFiltersOpen(false)} />
        </SheetContent>
      </Sheet>

      <Sheet open={sortOpen} onOpenChange={setSortOpen}>
        <SheetContent side="bottom" title="Sort by">
          <ul role="radiogroup" aria-label="Sort by" className="pb-2">
            {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
              <li key={option}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={filters.sort === option}
                  onClick={() => {
                    apply({ sort: option });
                    setSortOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-1 py-3.5 text-left text-sm transition-colors hover:bg-surface',
                    filters.sort === option ? 'font-medium text-ink' : 'text-muted',
                  )}
                >
                  {SORT_LABELS[option]}
                  {filters.sort === option && <span className="h-2 w-2 rounded-full bg-ink" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Desktop sort control — a plain select, which is the accessible default. */
export function SortSelect() {
  const { filters, apply } = useFilters();

  return (
    <div className="hidden items-center gap-2 lg:flex">
      <label htmlFor="sort" className="text-2xs uppercase tracking-wide2 text-muted">Sort</label>
      <select
        id="sort"
        value={filters.sort}
        onChange={(e) => apply({ sort: e.target.value as SortOption })}
        className="h-10 rounded-md border border-ink/15 bg-bg px-3 pr-8 text-sm text-ink transition-colors hover:border-ink/30"
      >
        {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
          <option key={option} value={option}>{SORT_LABELS[option]}</option>
        ))}
      </select>
    </div>
  );
}
