'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AvailableCoupons } from './available-coupons';
import { FreeShippingMeter } from './free-shipping-meter';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { useCart, useCartActions } from '@/hooks/use-cart';
import { useExpressCheckout } from '@/hooks/use-express-checkout';
import { formatPaise } from '@/lib/money';
import { rupees, track } from '@/lib/analytics';
import { cn } from '@/lib/utils';

/** Full-page bag — the same data as the drawer, laid out for review before checkout. */
export function CartPageClient() {
  const { data: cart, isLoading } = useCart();
  const { updateItem, removeItem, applyCoupon, removeCoupon } = useCartActions();
  const expressCheckout = useExpressCheckout();
  const [coupon, setCoupon] = React.useState('');

  React.useEffect(() => {
    if (cart && cart.lines.length > 0) {
      track({
        name: 'view_cart',
        value: rupees(cart.pricing.totalPaise),
        items: cart.lines.map((l) => ({
          id: l.productId, name: l.name, price: rupees(l.unitPricePaise), quantity: l.quantity,
        })),
      });
    }
    // Fires once per distinct cart state. Depending on `cart` itself would
    // re-send the "view_cart" event on every price or quantity re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart?.id, cart?.lines.length]);

  if (isLoading) {
    return (
      <div className="container py-10">
        <Skeleton className="mb-8 h-9 w-40" />
        <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-12">
          <div className="space-y-5">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-36 w-28 rounded-md" />
                <div className="flex-1 space-y-3 py-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/4" />
                  <Skeleton className="h-10 w-32" />
                </div>
              </div>
            ))}
          </div>
          <Skeleton className="mt-8 h-64 lg:mt-0" />
        </div>
      </div>
    );
  }

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="container py-10">
        <h1 className="text-3xl">Your bag</h1>
        <EmptyState
          title="Your bag is empty"
          message="Add something classy to get started."
          actionLabel="Browse collection"
          actionHref="/shop"
        />
      </div>
    );
  }

  const p = cart.pricing;
  const hasBlockingIssue = cart.lines.some((l) => l.issue === 'OUT_OF_STOCK');

  return (
    <div className="container py-8 lg:py-12">
      <h1 className="mb-1 text-3xl">Your bag</h1>
      <p className="mb-8 text-sm text-muted">{cart.itemCount} item{cart.itemCount === 1 ? '' : 's'}</p>

      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-12">
        <ul className="divide-y divide-line border-y border-line">
          {cart.lines.map((line) => (
            <li key={line.id} className="flex gap-4 py-5">
              <Link
                href={`/product/${line.slug}`}
                className="relative h-36 w-28 shrink-0 overflow-hidden rounded-md bg-surface"
              >
                {line.image ? (
                  <Image src={line.image} alt={line.name} fill sizes="112px" className="object-cover" />
                ) : (
                  <span className="grid h-full place-items-center text-2xs text-faint">No image</span>
                )}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/product/${line.slug}`} className="text-sm text-ink hover:underline">
                      {line.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted">{line.variantLabel}</p>
                    <p className="mt-0.5 text-2xs text-faint">SKU {line.sku}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      removeItem.mutate({
                        itemId: line.id,
                        meta: { id: line.productId, name: line.name, price: rupees(line.unitPricePaise) },
                      })
                    }
                    aria-label={`Remove ${line.name}`}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-surface hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>

                {line.issue === 'OUT_OF_STOCK' && (
                  <p className="mt-2 text-xs text-danger">Sold out — remove this item to continue.</p>
                )}
                {line.issue === 'QUANTITY_REDUCED' && (
                  <p className="mt-2 text-xs text-gold-ink">Only {line.maxQuantity} left; quantity updated.</p>
                )}

                <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                  <div className="flex items-center rounded-md border border-ink/15">
                    <button
                      type="button"
                      onClick={() => updateItem.mutate({ itemId: line.id, quantity: line.quantity - 1 })}
                      aria-label={`Decrease quantity of ${line.name}`}
                      className="grid h-10 w-10 place-items-center transition-colors hover:bg-surface"
                    >
                      <Minus className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <span className="min-w-9 text-center text-sm tabular-nums">{line.quantity}</span>
                    <button
                      type="button"
                      disabled={line.quantity >= line.maxQuantity}
                      onClick={() => updateItem.mutate({ itemId: line.id, quantity: line.quantity + 1 })}
                      aria-label={`Increase quantity of ${line.name}`}
                      className="grid h-10 w-10 place-items-center transition-colors hover:bg-surface disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">{formatPaise(line.lineTotalPaise)}</p>
                    {line.compareAtPaise && line.compareAtPaise > line.unitPricePaise && (
                      <p className="text-xs text-faint line-through tabular-nums">
                        {formatPaise(line.compareAtPaise * line.quantity)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* ── Summary ─────────────────────────────────────────────────── */}
        <aside className="mt-8 lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:mt-0">
          <div className="rounded-lg border border-line p-5">
            <h2 className="mb-4 font-serif text-lg">Order summary</h2>

            {p.coupon ? (
              <div className="mb-4 flex items-center justify-between gap-2 rounded-md bg-success/10 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-success">{p.coupon.code}</p>
                  <p className="text-xs text-success/80">You saved {formatPaise(p.coupon.discountPaise)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeCoupon.mutate()}
                  aria-label="Remove coupon"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-success/10"
                >
                  <X className="h-4 w-4 text-success" aria-hidden />
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (coupon.trim()) applyCoupon.mutate(coupon.trim());
                }}
                className="mb-4 flex gap-2"
              >
                <label htmlFor="coupon" className="sr-only">Coupon code</label>
                <Input
                  id="coupon"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                  placeholder="Coupon code"
                  className="h-11 flex-1 uppercase"
                  autoComplete="off"
                />
                <Button type="submit" variant="outline" className="h-11" loading={applyCoupon.isPending}>
                  Apply
                </Button>
              </form>
            )}

            <AvailableCoupons
              appliedCode={p.coupon?.code ?? null}
              onApply={(code: string) => applyCoupon.mutate(code)}
            />

            <div className="mb-4 mt-4">
              <FreeShippingMeter pricing={p} />
            </div>

            <dl className="space-y-2 text-sm">
              <Row label="Subtotal" value={formatPaise(p.subtotalPaise)} />
              {p.discountPaise > 0 && (
                <Row label="Discount" value={`− ${formatPaise(p.discountPaise)}`} tone="success" />
              )}
              <Row
                label="Delivery"
                value={p.estimatedShippingPaise === 0 ? 'FREE' : formatPaise(p.estimatedShippingPaise)}
                tone={p.estimatedShippingPaise === 0 ? 'success' : undefined}
              />
              {p.handlingPaise > 0 && <Row label="Handling" value={formatPaise(p.handlingPaise)} />}
              {p.taxPaise > 0 && <Row label="Tax" value={formatPaise(p.taxPaise)} />}
            </dl>

            <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
              <span className="font-sans font-medium">Estimated total</span>
              <span className="font-sans text-xl font-medium tabular-nums">{formatPaise(p.estimatedTotalPaise)}</span>
            </div>

            {/*
              Straight to Cashfree's payment sheet — no intermediate form,
              since One Click Checkout collects the address, contact details
              and COD choice itself.
            */}
            <Button
              size="xl"
              full
              className="mt-5"
              disabled={hasBlockingIssue}
              loading={expressCheckout.pending}
              onClick={() => {
                track({
                  name: 'begin_checkout',
                  value: rupees(p.totalPaise),
                  coupon: p.coupon?.code,
                  items: cart.lines.map((l) => ({
                    id: l.productId, name: l.name, price: rupees(l.unitPricePaise), quantity: l.quantity,
                  })),
                });
                void expressCheckout.start();
              }}
            >
              {hasBlockingIssue ? 'Remove sold-out items' : 'Checkout with Cashfree'}
            </Button>

            <Link
              href="/shop"
              className="mt-3 block text-center text-2xs font-medium uppercase tracking-wide2 text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Continue shopping
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'success' }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className={cn('tabular-nums', tone === 'success' ? 'font-medium text-success' : 'text-ink')}>{value}</dd>
    </div>
  );
}
