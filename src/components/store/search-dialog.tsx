'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Clock, Search, TrendingUp, X } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPaise } from '@/lib/money';
import { track } from '@/lib/analytics';
import type { ProductCardDTO } from '@/types';

const RECENT_KEY = 'yd_recent_searches';

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string').slice(0, 6) : [];
  } catch {
    return [];
  }
}

function pushRecent(term: string) {
  try {
    const next = [term, ...readRecent().filter((t) => t !== term)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — recent searches simply do not persist */
  }
}

interface Suggestions {
  products: ProductCardDTO[];
  categories: { slug: string; name: string }[];
  popular: string[];
  total: number;
}

/**
 * Search overlay. The query is debounced and every result comes from
 * /api/search — the client never touches the database or builds a query.
 */
export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [term, setTerm] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [recent, setRecent] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (open) setRecent(readRecent());
  }, [open]);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 220);
    return () => clearTimeout(t);
  }, [term]);

  const { data, isFetching } = useQuery({
    queryKey: ['search', debounced],
    queryFn: async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(debounced)}&limit=6`);
      if (!res.ok) throw new Error('Search failed');
      return (await res.json()) as Suggestions;
    },
    enabled: open && debounced.length >= 2,
  });

  const submit = (value: string) => {
    const q = value.trim();
    if (!q) return;
    pushRecent(q);
    track({ name: 'search', term: q, results: data?.total ?? 0 });
    onOpenChange(false);
    setTerm('');
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const showSuggestions = debounced.length >= 2;
  const hasResults = (data?.products.length ?? 0) > 0 || (data?.categories.length ?? 0) > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        title="Search"
        hideTitle
        className="top-0 max-h-none rounded-none lg:mx-auto lg:mt-0 lg:max-w-2xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(term);
          }}
          role="search"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-faint" aria-hidden />
            <label htmlFor="site-search" className="sr-only">Search products</label>
            <Input
              id="site-search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search shirts, shakets…"
              autoFocus
              autoComplete="off"
              enterKeyHint="search"
              className="h-13 pl-11 pr-10"
              aria-describedby="search-hint"
            />
            {term && (
              <button
                type="button"
                onClick={() => setTerm('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-faint hover:bg-surface hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
          <p id="search-hint" className="sr-only">Results update as you type.</p>
        </form>

        <div className="mt-6" aria-live="polite">
          {!showSuggestions && (
            <div className="space-y-6">
              {recent.length > 0 && (
                <section>
                  <p className="eyebrow mb-2.5 flex items-center gap-1.5">
                    <Clock className="h-3 w-3" aria-hidden /> Recent
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {recent.map((r) => (
                      <li key={r}>
                        <button
                          type="button"
                          onClick={() => submit(r)}
                          className="rounded-full border border-ink/15 px-3 py-1.5 text-sm text-muted transition-colors hover:border-ink hover:text-ink"
                        >
                          {r}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <p className="eyebrow mb-2.5 flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3" aria-hidden /> Browse
                </p>
                <ul className="flex flex-wrap gap-2">
                  {['Shirts', 'Shakets', 'New Arrivals', 'Best Sellers'].map((label) => (
                    <li key={label}>
                      <button
                        type="button"
                        onClick={() => submit(label)}
                        className="rounded-full bg-surface px-3 py-1.5 text-sm text-ink transition-colors hover:bg-sunken"
                      >
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}

          {showSuggestions && isFetching && !data && (
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-16 w-12 rounded-md" />
                  <div className="flex-1 space-y-2 py-1">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {showSuggestions && data && !hasResults && !isFetching && (
            <div className="py-10 text-center">
              <p className="font-serif text-lg">No results for “{debounced}”</p>
              <p className="mt-1.5 text-sm text-muted">Try a shorter or more general term.</p>
              <Link
                href="/shop"
                onClick={() => onOpenChange(false)}
                className="mt-4 inline-block text-2xs font-medium uppercase tracking-wide2 text-gold-ink underline underline-offset-4"
              >
                Browse everything
              </Link>
            </div>
          )}

          {showSuggestions && data && hasResults && (
            <div className="space-y-6">
              {data.categories.length > 0 && (
                <section>
                  <p className="eyebrow mb-2.5">Collections</p>
                  <ul className="flex flex-wrap gap-2">
                    {data.categories.map((c) => (
                      <li key={c.slug}>
                        <Link
                          href={`/category/${c.slug}`}
                          onClick={() => onOpenChange(false)}
                          className="rounded-full bg-surface px-3 py-1.5 text-sm text-ink hover:bg-sunken"
                        >
                          {c.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {data.products.length > 0 && (
                <section>
                  <p className="eyebrow mb-2.5">Products</p>
                  <ul className="divide-y divide-line">
                    {data.products.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/product/${p.slug}`}
                          onClick={() => onOpenChange(false)}
                          className="flex items-center gap-3 py-2.5 transition-colors hover:bg-surface"
                        >
                          <span className="relative h-16 w-12 shrink-0 overflow-hidden rounded-md bg-surface">
                            {p.image && !p.image.isPlaceholder && (
                              <Image src={p.image.url} alt="" fill sizes="48px" className="object-cover" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2-safe block text-sm text-ink">{p.name}</span>
                            <span className="mt-0.5 block text-xs text-muted">{formatPaise(p.pricePaise)}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>

                  {data.total > data.products.length && (
                    <button
                      type="button"
                      onClick={() => submit(debounced)}
                      className="mt-3 w-full rounded-md bg-surface py-3 text-2xs font-medium uppercase tracking-wide2 text-ink hover:bg-sunken"
                    >
                      See all {data.total} results
                    </button>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
