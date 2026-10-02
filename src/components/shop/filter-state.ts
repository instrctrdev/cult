'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { SortOption } from '@/types';

export interface ActiveFilters {
  size: string[];
  color: string[];
  category: string[];
  minPrice?: number;
  maxPrice?: number;
  inStock: boolean;
  onSale: boolean;
  sort: SortOption;
  page: number;
}

export const SORT_LABELS: Record<SortOption, string> = {
  featured: 'Featured',
  newest: 'Newest first',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  discount: 'Biggest discount',
  'name-asc': 'Name: A–Z',
};

/**
 * Filters live in the URL, not React state.
 *
 * That makes every filtered view shareable, back-button correct, and
 * server-renderable — the listing page reads the same query string the
 * sidebar writes.
 */
export function useFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const filters: ActiveFilters = useMemo(() => {
    const list = (key: string) => params.get(key)?.split(',').filter(Boolean) ?? [];
    const num = (key: string) => {
      const raw = params.get(key);
      const n = raw ? Number(raw) : NaN;
      return Number.isFinite(n) ? n : undefined;
    };

    return {
      size: list('size'),
      color: list('color'),
      category: list('category'),
      minPrice: num('minPrice'),
      maxPrice: num('maxPrice'),
      inStock: params.get('inStock') === '1',
      onSale: params.get('onSale') === '1',
      sort: (params.get('sort') as SortOption) || 'featured',
      page: num('page') ?? 1,
    };
  }, [params]);

  const apply = useCallback(
    (next: Partial<ActiveFilters>, opts: { replace?: boolean } = {}) => {
      const sp = new URLSearchParams(params.toString());
      const merged = { ...filters, ...next };

      /** Writes a param when it carries meaning, drops it when it does not. */
      const set = (key: string, value: string | null) => {
        if (value) sp.set(key, value);
        else sp.delete(key);
      };

      set('size', merged.size.join(',') || null);
      set('color', merged.color.join(',') || null);
      set('category', merged.category.join(',') || null);
      set('minPrice', merged.minPrice != null ? String(merged.minPrice) : null);
      set('maxPrice', merged.maxPrice != null ? String(merged.maxPrice) : null);
      set('inStock', merged.inStock ? '1' : null);
      set('onSale', merged.onSale ? '1' : null);
      set('sort', merged.sort !== 'featured' ? merged.sort : null);

      // Any filter change resets pagination — page 3 of the old result set is
      // meaningless against a new one.
      set('page', next.page != null && next.page > 1 ? String(next.page) : null);

      const qs = sp.toString();
      router[opts.replace ? 'replace' : 'push'](qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [filters, params, pathname, router],
  );

  const toggleValue = useCallback(
    (key: 'size' | 'color' | 'category', value: string) => {
      const current = filters[key];
      apply({ [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] });
    },
    [apply, filters],
  );

  const clearAll = useCallback(() => {
    const sp = new URLSearchParams();
    // A search term is not a filter — clearing filters must not clear it.
    const q = params.get('q');
    if (q) sp.set('q', q);
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  const activeCount =
    filters.size.length +
    filters.color.length +
    filters.category.length +
    (filters.minPrice != null || filters.maxPrice != null ? 1 : 0) +
    (filters.inStock ? 1 : 0) +
    (filters.onSale ? 1 : 0);

  return { filters, apply, toggleValue, clearAll, activeCount };
}
