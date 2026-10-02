'use client';

import * as React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPaise } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { useFilters } from './filter-state';
import type { ProductListResult } from '@/types';

/**
 * The filter controls themselves. Rendered as a desktop sidebar and reused
 * verbatim inside the mobile bottom sheet, so the two can never drift apart.
 */
export function FilterPanel({
  facets,
  showCategories = true,
  onApplied,
}: {
  facets: ProductListResult['facets'];
  showCategories?: boolean;
  onApplied?: () => void;
}) {
  const { filters, apply, toggleValue, clearAll, activeCount } = useFilters();

  const minRupees = Math.floor(facets.priceRangePaise.min / 100);
  const maxRupees = Math.ceil(facets.priceRangePaise.max / 100);
  const hasPriceRange = maxRupees > minRupees;

  return (
    <div className="space-y-7">
      {activeCount > 0 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted">{activeCount} filter{activeCount === 1 ? '' : 's'} applied</p>
          <button
            type="button"
            onClick={() => {
              clearAll();
              onApplied?.();
            }}
            className="text-2xs font-medium uppercase tracking-wide2 text-gold-ink underline-offset-4 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      <Group title="Availability">
        <CheckRow
          label="In stock only"
          checked={filters.inStock}
          onChange={() => apply({ inStock: !filters.inStock })}
        />
        <CheckRow
          label="On sale"
          checked={filters.onSale}
          onChange={() => apply({ onSale: !filters.onSale })}
        />
      </Group>

      {facets.sizes.length > 0 && (
        <Group title="Size">
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((size) => {
              const active = filters.size.includes(size.value);
              return (
                <button
                  key={size.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleValue('size', size.value)}
                  className={cn(
                    'h-11 min-w-12 rounded-md border px-3 text-sm transition-colors',
                    active ? 'border-ink bg-ink text-bg' : 'border-ink/20 text-ink hover:border-ink',
                  )}
                >
                  {size.label}
                </button>
              );
            })}
          </div>
        </Group>
      )}

      {facets.colors.length > 0 && (
        <Group title="Colour">
          <ul className="space-y-1">
            {facets.colors.map((color) => {
              const active = filters.color.includes(color.value);
              return (
                <li key={color.value}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleValue('color', color.value)}
                    className="flex w-full items-center gap-2.5 rounded-md px-1 py-2 text-left transition-colors hover:bg-surface"
                  >
                    <span
                      className={cn(
                        'grid h-5 w-5 shrink-0 place-items-center rounded-full ring-1 ring-inset ring-ink/20',
                        active && 'ring-2 ring-ink ring-offset-1 ring-offset-bg',
                      )}
                      style={{ backgroundColor: color.meta?.hex }}
                      aria-hidden
                    />
                    <span className={cn('flex-1 text-sm', active ? 'text-ink' : 'text-muted')}>{color.label}</span>
                    <span className="text-2xs text-faint">{color.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Group>
      )}

      {showCategories && facets.categories.length > 0 && (
        <Group title="Collection">
          <ul className="space-y-0.5">
            {facets.categories.map((category) => (
              <li key={category.value}>
                <CheckRow
                  label={category.label}
                  count={category.count}
                  checked={filters.category.includes(category.value)}
                  onChange={() => toggleValue('category', category.value)}
                />
              </li>
            ))}
          </ul>
        </Group>
      )}

      {hasPriceRange && (
        <Group title="Price">
          <PriceFilter
            min={minRupees}
            max={maxRupees}
            value={[filters.minPrice ?? minRupees, filters.maxPrice ?? maxRupees]}
            onCommit={([lo, hi]) =>
              apply({
                minPrice: lo > minRupees ? lo : undefined,
                maxPrice: hi < maxRupees ? hi : undefined,
              })
            }
          />
          <p className="mt-2 text-xs text-muted">
            {formatPaise((filters.minPrice ?? minRupees) * 100)} – {formatPaise((filters.maxPrice ?? maxRupees) * 100)}
          </p>
        </Group>
      )}

      {onApplied && (
        <Button size="xl" full onClick={onApplied} className="lg:hidden">
          Show results
        </Button>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="eyebrow mb-3">{title}</legend>
      {children}
    </fieldset>
  );
}

function CheckRow({
  label, checked, onChange, count,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  count?: number;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-2 transition-colors hover:bg-surface">
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        className={cn(
          'grid h-[18px] w-[18px] shrink-0 place-items-center rounded border transition-colors',
          checked ? 'border-ink bg-ink text-bg' : 'border-ink/25',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-gold peer-focus-visible:ring-offset-2',
        )}
        aria-hidden
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className={cn('flex-1 text-sm', checked ? 'text-ink' : 'text-muted')}>{label}</span>
      {count != null && <span className="text-2xs text-faint">{count}</span>}
    </label>
  );
}

/**
 * Dual-handle price range built from two native sliders.
 *
 * Native inputs keep it keyboard- and screen-reader-accessible for free, and
 * the handles are clamped so they cannot cross.
 */
function PriceFilter({
  min, max, value, onCommit,
}: {
  min: number;
  max: number;
  value: [number, number];
  onCommit: (value: [number, number]) => void;
}) {
  const [local, setLocal] = React.useState<[number, number]>(value);
  const [committedLow, committedHigh] = value;

  // Re-sync the handles when the applied range changes (e.g. filters cleared).
  React.useEffect(() => {
    setLocal([committedLow, committedHigh]);
  }, [committedLow, committedHigh]);

  const pct = (v: number) => ((v - min) / Math.max(1, max - min)) * 100;

  return (
    <div className="pt-1">
      <div className="relative h-9">
        <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-ink/10" aria-hidden />
        <span
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-ink"
          style={{ left: `${pct(local[0])}%`, right: `${100 - pct(local[1])}%` }}
          aria-hidden
        />
        {([0, 1] as const).map((i) => (
          <input
            key={i}
            type="range"
            min={min}
            max={max}
            step={50}
            value={local[i]}
            aria-label={i === 0 ? 'Minimum price' : 'Maximum price'}
            onChange={(e) => {
              const n = Number(e.target.value);
              setLocal((prev) =>
                i === 0 ? [Math.min(n, prev[1]), prev[1]] : [prev[0], Math.max(n, prev[0])],
              );
            }}
            onPointerUp={() => onCommit(local)}
            onKeyUp={() => onCommit(local)}
            className={cn(
              'pointer-events-none absolute inset-x-0 top-1/2 h-9 w-full -translate-y-1/2 appearance-none bg-transparent',
              '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5',
              '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
              '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-ink [&::-webkit-slider-thumb]:bg-bg',
              '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5',
              '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-ink [&::-moz-range-thumb]:bg-bg',
            )}
          />
        ))}
      </div>
    </div>
  );
}

/** Removable chips summarising what is currently filtered. */
export function ActiveFilterChips({ facets }: { facets: ProductListResult['facets'] }) {
  const { filters, apply, toggleValue, activeCount } = useFilters();
  if (activeCount === 0) return null;

  const chips: { key: string; label: string; onRemove: () => void }[] = [
    ...filters.size.map((s) => ({ key: `size-${s}`, label: `Size ${s}`, onRemove: () => toggleValue('size', s) })),
    ...filters.color.map((c) => ({
      key: `color-${c}`,
      label: facets.colors.find((f) => f.value === c)?.label ?? c,
      onRemove: () => toggleValue('color', c),
    })),
    ...filters.category.map((c) => ({
      key: `cat-${c}`,
      label: facets.categories.find((f) => f.value === c)?.label ?? c,
      onRemove: () => toggleValue('category', c),
    })),
    ...(filters.inStock ? [{ key: 'stock', label: 'In stock', onRemove: () => apply({ inStock: false }) }] : []),
    ...(filters.onSale ? [{ key: 'sale', label: 'On sale', onRemove: () => apply({ onSale: false }) }] : []),
    ...(filters.minPrice != null || filters.maxPrice != null
      ? [{ key: 'price', label: 'Price', onRemove: () => apply({ minPrice: undefined, maxPrice: undefined }) }]
      : []),
  ];

  return (
    <ul className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            onClick={chip.onRemove}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface py-1.5 pl-3 pr-2 text-xs text-ink transition-colors hover:bg-sunken"
          >
            {chip.label}
            <X className="h-3 w-3 text-muted" aria-hidden />
            <span className="sr-only">Remove filter</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
