'use client';

import * as React from 'react';
import { formatPaise } from '@/lib/money';

interface Point {
  date: string;
  revenuePaise: number;
  orders: number;
}

/**
 * Sales bar chart drawn as inline SVG.
 *
 * Deliberately not a charting library — one chart does not justify shipping
 * ~100KB of JS to the admin bundle, and this keeps the dashboard fast.
 */
export function SalesChart({ data }: { data: Point[] }) {
  const [hover, setHover] = React.useState<number | null>(null);

  const max = Math.max(...data.map((d) => d.revenuePaise), 1);
  const total = data.reduce((sum, d) => sum + d.revenuePaise, 0);
  const orders = data.reduce((sum, d) => sum + d.orders, 0);

  if (total === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted">
        No confirmed sales in the last 30 days yet.
      </p>
    );
  }

  const active = hover != null ? data[hover] : null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-6">
        <div>
          <p className="text-2xs uppercase tracking-wide2 text-muted">30-day revenue</p>
          <p className="figure font-serif text-xl">{formatPaise(total)}</p>
        </div>
        <div>
          <p className="text-2xs uppercase tracking-wide2 text-muted">Orders</p>
          <p className="figure font-serif text-xl">{orders}</p>
        </div>
        {active && (
          <div className="ml-auto text-right">
            <p className="text-2xs uppercase tracking-wide2 text-muted">
              {new Date(active.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </p>
            <p className="figure font-serif text-xl">{formatPaise(active.revenuePaise)}</p>
          </div>
        )}
      </div>

      <div
        className="flex h-28 items-end gap-[2px]"
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`Daily revenue for the last 30 days. Total ${formatPaise(total)} across ${orders} orders.`}
      >
        {data.map((point, i) => (
          <div
            key={point.date}
            onMouseEnter={() => setHover(i)}
            className="group relative flex h-full flex-1 items-end"
          >
            <div
              className={`w-full rounded-t-[3px] transition-colors ${
                point.revenuePaise === 0
                  ? 'bg-line'
                  : hover === i
                    ? 'bg-ink'
                    : 'bg-ink/25 group-hover:bg-ink/45'
              }`}
              // A day with no sales draws a flat baseline rather than a stub,
              // so a sparse month reads as quiet instead of noisy.
              style={{ height: point.revenuePaise === 0 ? '2px' : `${Math.max(6, (point.revenuePaise / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-between text-2xs text-faint">
        <span>{new Date(data[0].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
        <span>{new Date(data[data.length - 1].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
      </div>
    </div>
  );
}
