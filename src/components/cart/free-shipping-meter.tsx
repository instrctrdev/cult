'use client';

import { formatPaise } from '@/lib/money';
import type { PricingBreakdown } from '@/types';

/**
 * How far the bag is from free delivery.
 *
 * The bar is the point: a number alone ("Rs. 200 to go") is read as a cost,
 * while a bar most of the way along reads as something nearly earned. Shown
 * even when the gateway does the charging — the threshold is still true, and
 * it is the one figure a shopper acts on.
 */
export function FreeShippingMeter({ pricing, compact = false }: { pricing: PricingBreakdown; compact?: boolean }) {
  const { freeEnabled, freeThresholdPaise, feePaise, prepaidFree } = pricing.shippingPolicy;

  /**
   * With prepaid delivery free, a spend-more bar is the wrong message — there
   * is nothing left to earn, and the only decision still open is how to pay.
   * So the meter becomes the statement of that choice instead.
   */
  if (prepaidFree) {
    return (
      <div className={compact ? 'rounded-md bg-surface p-3' : 'rounded-lg border border-line p-4'}>
        <p className="text-xs text-muted text-pretty">
          <span className="font-medium text-success">Free delivery</span> when you pay online
          {feePaise > 0 && <> — {formatPaise(feePaise)} on cash on delivery</>}
        </p>
      </div>
    );
  }

  if (!freeEnabled || freeThresholdPaise <= 0) return null;

  const remaining = pricing.freeShippingRemainingPaise;
  const unlocked = remaining <= 0;
  const progress = unlocked ? 100 : Math.min(100, ((freeThresholdPaise - remaining) / freeThresholdPaise) * 100);

  return (
    <div className={compact ? 'rounded-md bg-surface p-3' : 'rounded-lg border border-line p-4'}>
      <p className="text-xs text-muted text-pretty">
        {unlocked ? (
          <span className="font-medium text-success">You&apos;ve unlocked free delivery 🎉</span>
        ) : (
          <>
            Add <strong className="text-ink">{formatPaise(remaining)}</strong> more for{' '}
            <span className="font-medium text-success">free delivery</span>
          </>
        )}
      </p>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10" role="presentation">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${unlocked ? 'bg-success' : 'bg-gold'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {!unlocked && (
        <p className="mt-1.5 text-2xs text-faint">
          Delivery {formatPaise(pricing.shippingPolicy.feePaise)} below {formatPaise(freeThresholdPaise)}
        </p>
      )}
    </div>
  );
}
