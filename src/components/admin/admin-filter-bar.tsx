'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface AdminFilter {
  label: string;
  param: Record<string, string>;
}

/** Shared search + quick-filter strip for the admin list screens. */
export function AdminFilterBar({
  basePath,
  filters,
  searchPlaceholder = 'Search',
}: {
  basePath: string;
  filters: AdminFilter[];
  searchPlaceholder?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = React.useState(params.get('q') ?? '');

  const isActive = (filter: AdminFilter) => {
    const keys = Object.keys(filter.param);
    if (keys.length === 0) return !params.get('status') && !params.get('unfulfilled');
    return keys.every((k) => params.get(k) === filter.param[k]);
  };

  const hrefFor = (filter: AdminFilter) => {
    const next = new URLSearchParams();
    const q = params.get('q');
    if (q) next.set('q', q);
    for (const [k, v] of Object.entries(filter.param)) next.set(k, v);
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="space-y-3">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const next = new URLSearchParams(params.toString());
          const term = query.trim();
          if (term) next.set('q', term);
          else next.delete('q');
          next.delete('page');
          const qs = next.toString();
          router.push(qs ? `${basePath}?${qs}` : basePath);
        }}
        className="relative max-w-sm"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
        <label htmlFor="admin-search" className="sr-only">{searchPlaceholder}</label>
        <Input
          id="admin-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-10 pl-9"
        />
      </form>

      {filters.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {filters.map((filter) => (
            <li key={filter.label}>
              <Link
                href={hrefFor(filter)}
                className={cn(
                  'inline-block rounded-full px-3 py-1.5 text-xs capitalize transition-colors',
                  isActive(filter) ? 'bg-ink text-bg' : 'bg-surface text-muted hover:text-ink',
                )}
              >
                {filter.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
