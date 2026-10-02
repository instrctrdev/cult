'use client';

import * as React from 'react';
import { Check, Copy, Tag } from 'lucide-react';
import { formatPaise } from '@/lib/money';
import { cn } from '@/lib/utils';

interface Offer {
  code: string;
  description: string | null;
  label: string;
  minOrderPaise: number;
  shortfallPaise: number;
}

/**
 * Offers the shopper could use on this bag.
 *
 * A code they cannot yet afford is shown too, greyed, saying what it needs —
 * that is the half of the message that sells another item, and hiding it just
 * makes the offer look non-existent. Only ones they can use get Apply.
 */
export function AvailableCoupons({
  appliedCode,
  onApply,
}: {
  appliedCode: string | null;
  onApply: (code: string) => void | Promise<void>;
}) {
  const [offers, setOffers] = React.useState<Offer[]>([]);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [showAll, setShowAll] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    fetch('/api/coupons/available')
      .then((r) => r.json())
      .then((j) => { if (alive && Array.isArray(j?.offers)) setOffers(j.offers); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [appliedCode]);

  if (offers.length === 0) return null;

  // A wall of codes is noise. The usable ones come first from the server, so
  // the first few are the ones worth acting on; the rest stay one tap away.
  const VISIBLE = 3;
  const shown = showAll ? offers : offers.slice(0, VISIBLE);
  const hidden = offers.length - shown.length;

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      window.setTimeout(() => setCopied((c) => (c === code ? null : c)), 1600);
    } catch {
      // Clipboard is blocked in some browsers; the code is on screen to type.
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="flex items-center gap-1.5 text-2xs uppercase tracking-wide2 text-muted">
        <Tag className="h-3 w-3" aria-hidden />
        Offers for this bag
      </p>

      <ul className="space-y-2">
        {shown.map((offer) => {
          const usable = offer.shortfallPaise <= 0;
          const applied = appliedCode?.toUpperCase() === offer.code.toUpperCase();

          return (
            <li
              key={offer.code}
              className={cn(
                'flex items-center gap-2 rounded-md border border-dashed p-2.5',
                usable ? 'border-success/50 bg-success/[0.04]' : 'border-line',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-xs">
                  <span className={cn('font-medium tracking-wide2', usable ? 'text-success' : 'text-muted')}>
                    {offer.code}
                  </span>
                  <span className="text-muted">{offer.label}</span>
                </p>
                <p className="mt-0.5 text-2xs text-faint text-pretty">
                  {usable
                    ? offer.description ?? 'Ready to use on this bag.'
                    : `Add ${formatPaise(offer.shortfallPaise)} more to use this`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => copy(offer.code)}
                aria-label={`Copy code ${offer.code}`}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink"
              >
                {copied === offer.code ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              </button>

              {usable && !applied && (
                <button
                  type="button"
                  onClick={() => onApply(offer.code)}
                  className="shrink-0 rounded-md border border-success px-2.5 py-1 text-2xs font-medium uppercase tracking-wide2 text-success transition-colors hover:bg-success hover:text-white"
                >
                  Apply
                </button>
              )}
              {applied && (
                <span className="shrink-0 text-2xs font-medium uppercase tracking-wide2 text-success">Applied</span>
              )}
            </li>
          );
        })}
      </ul>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-2xs uppercase tracking-wide2 text-muted underline underline-offset-4 transition-colors hover:text-ink"
        >
          Show {hidden} more offer{hidden === 1 ? '' : 's'}
        </button>
      )}
    </div>
  );
}
