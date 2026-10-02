import { cn } from '@/lib/utils';
import { formatPaise } from '@/lib/money';

/**
 * Sale styling follows the live store: current price in ink, the struck-through
 * compare-at price muted beside it, and a "NN% OFF" badge.
 *
 * The badge is a tinted pill rather than bare coloured text — the saving is the
 * thing a shopper scans for, and a block of colour finds the eye where a word
 * the same size as its neighbours does not.
 */
export function Price({
  pricePaise,
  compareAtPaise,
  size = 'md',
  showDiscount = true,
  className,
}: {
  pricePaise: number;
  compareAtPaise?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showDiscount?: boolean;
  className?: string;
}) {
  const onSale = Boolean(compareAtPaise && compareAtPaise > pricePaise);
  const percent = onSale ? Math.round(((compareAtPaise! - pricePaise) / compareAtPaise!) * 100) : null;

  const sizes = {
    sm: { now: 'text-sm font-medium', was: 'text-xs', off: 'text-2xs px-1.5 py-0.5' },
    md: { now: 'text-base font-medium', was: 'text-sm', off: 'text-2xs px-1.5 py-0.5' },
    lg: { now: 'text-2xl font-medium', was: 'text-base', off: 'text-xs px-2 py-1' },
  }[size];

  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      {onSale && (
        <span className={cn(sizes.was, 'text-faint line-through')}>
          {formatPaise(compareAtPaise!)}
          <span className="sr-only"> original price</span>
        </span>
      )}

      <span className={cn(sizes.now, 'text-ink')}>{formatPaise(pricePaise)}</span>

      {onSale && showDiscount && percent !== null && percent > 0 && (
        <span
          className={cn(
            sizes.off,
            'rounded-md bg-success/10 font-sans font-semibold uppercase tracking-wide2 text-success',
          )}
        >
          {percent}% off
        </span>
      )}
    </p>
  );
}
