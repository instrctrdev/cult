import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Funnel {
  days: number;
  views: number;
  addToCart: number;
  purchases: number;
  viewToCartPercent: number | null;
  cartToPurchasePercent: number | null;
}

interface ViewedProduct {
  name: string;
  slug: string;
  views: number;
  sizes: number;
  inStock: number;
}

/**
 * Where shoppers stop.
 *
 * Three stages of one measure — people — so the bars share a single colour and
 * length carries the magnitude; there is no identity to encode and so no
 * legend. Every value is labelled directly rather than hidden behind a hover,
 * because the whole point is to read the drop at a glance.
 *
 * A tiny count still draws a sliver rather than nothing: a stage that rounds
 * to zero pixels reads as "no data" when it actually means "almost nobody got
 * this far", which is the opposite of the truth.
 */
export function BehaviourFunnel({ funnel, viewed }: { funnel: Funnel; viewed: ViewedProduct[] }) {
  const stages = [
    { label: 'Viewed a product', value: funnel.views },
    { label: 'Added to bag', value: funnel.addToCart },
    { label: 'Bought', value: funnel.purchases },
  ];
  const max = Math.max(...stages.map((s) => s.value), 1);

  // A guide, not a rule: a typical store turns 5-10% of product views into
  // bags. Well under that usually means something concrete is in the way.
  const cartRateLow = funnel.viewToCartPercent !== null && funnel.viewToCartPercent < 3;

  const shortOfStock = viewed.filter((v) => v.sizes > 0 && v.inStock < v.sizes);

  if (funnel.views === 0) {
    return (
      <p className="rounded-lg border border-line p-5 text-sm text-muted">
        No customer activity recorded in the last {funnel.days} days yet. Views and bag activity
        appear here as shoppers browse — your own admin browsing is deliberately excluded.
      </p>
    );
  }

  return (
    <div className="space-y-6 rounded-lg border border-line p-5">
      <div>
        <h2 className="font-serif text-lg">Where shoppers stop</h2>
        <p className="mt-1 text-sm text-muted">
          Last {funnel.days} days. Your own admin browsing is excluded.
        </p>
      </div>

      <div
        role="img"
        aria-label={`Funnel over the last ${funnel.days} days: ${funnel.views} product views, ${funnel.addToCart} added to bag, ${funnel.purchases} purchased.`}
      >
        {stages.map((stage, i) => {
          const rate = i === 1 ? funnel.viewToCartPercent : i === 2 ? funnel.cartToPurchasePercent : null;
          const flagged = i === 1 && cartRateLow;

          return (
            <div key={stage.label}>
              {rate !== null && (
                <div className="flex items-center gap-2 py-1.5 pl-[8.25rem] text-2xs sm:pl-[9.75rem]">
                  <span className="text-faint">↓</span>
                  <span className={cn('figure', flagged ? 'font-medium text-danger' : 'text-muted')}>
                    {rate.toFixed(1)}%
                  </span>
                  {flagged && (
                    <span className="inline-flex items-center gap-1 text-danger">
                      <AlertTriangle className="h-3 w-3" aria-hidden />
                      low — most stores see 5–10%
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3">
                <span className="w-[7.5rem] shrink-0 text-sm text-muted sm:w-36">{stage.label}</span>
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <div
                    className="h-6 rounded-r-[4px] bg-ink"
                    style={{ width: `${Math.max((stage.value / max) * 100, stage.value > 0 ? 0.6 : 0)}%` }}
                  />
                  <span className="figure shrink-0 font-serif text-base">{stage.value}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {shortOfStock.length > 0 && (
        <div className="border-t border-line pt-5">
          <h3 className="text-sm font-medium text-ink">Demand you are turning away</h3>
          <p className="mt-1 text-sm text-muted">
            These were viewed while some sizes were unavailable — the most likely reason people did
            not add to bag.
          </p>
          <ul className="mt-3 space-y-2">
            {shortOfStock.map((p) => (
              <li key={p.slug} className="flex items-baseline justify-between gap-3 text-sm">
                <Link href={`/product/${p.slug}`} className="truncate text-ink hover:underline">
                  {p.name}
                </Link>
                <span className="figure shrink-0 text-muted">
                  {p.views} view{p.views === 1 ? '' : 's'} ·{' '}
                  <span className="text-danger">
                    {p.inStock} of {p.sizes} sizes
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
