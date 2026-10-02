'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useCart, useCartActions } from '@/hooks/use-cart';
import { useExpressCheckout } from '@/hooks/use-express-checkout';
import { formatPaise } from '@/lib/money';
import { FreeShippingMeter } from '@/components/cart/free-shipping-meter';
import { rupees, track } from '@/lib/analytics';
import { cn } from '@/lib/utils';

/** Slide-over bag. All figures come from the server's pricing breakdown. */
export function CartDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: cart, isLoading } = useCart();
  const { updateItem, removeItem, applyCoupon, removeCoupon } = useCartActions();
  const expressCheckout = useExpressCheckout();
  const [couponInput, setCouponInput] = React.useState('');

  const pricing = cart?.pricing;
  const isEmpty = !isLoading && (cart?.lines.length ?? 0) === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        title="Your bag"
        description={cart?.itemCount ? `${cart.itemCount} item${cart.itemCount === 1 ? '' : 's'}` : undefined}
        footer={
          !isEmpty && pricing ? (
            <div className="space-y-3">
              <dl className="space-y-1.5 text-sm">
                <Row label="Subtotal" value={formatPaise(pricing.subtotalPaise)} />
                {pricing.discountPaise > 0 && (
                  <Row label={`Discount${pricing.coupon ? ` (${pricing.coupon.code})` : ''}`} value={`− ${formatPaise(pricing.discountPaise)}`} tone="success" />
                )}
                <Row
                  label="Delivery"
                  value={pricing.estimatedShippingPaise === 0 ? 'FREE' : formatPaise(pricing.estimatedShippingPaise)}
                  tone={pricing.estimatedShippingPaise === 0 ? 'success' : undefined}
                />
                {pricing.handlingPaise > 0 && <Row label="Handling" value={formatPaise(pricing.handlingPaise)} />}
                <div className="!mt-3 flex items-baseline justify-between border-t border-line pt-3">
                  <dt className="font-sans text-sm font-medium">Estimated total</dt>
                  <dd className="font-sans text-lg font-medium">{formatPaise(pricing.estimatedTotalPaise)}</dd>
                </div>
              </dl>

              <Button
                size="xl"
                full
                loading={expressCheckout.pending}
                onClick={() => {
                  track({
                    name: 'begin_checkout',
                    value: rupees(pricing.totalPaise),
                    coupon: pricing.coupon?.code,
                    items: (cart?.lines ?? []).map((l) => ({
                      id: l.productId, name: l.name, price: rupees(l.unitPricePaise),
                      quantity: l.quantity, variant: l.variantLabel,
                    })),
                  });
                  // Close the drawer so Cashfree's sheet is not layered over it.
                  onOpenChange(false);
                  void expressCheckout.start();
                }}
              >
                Checkout with Cashfree
              </Button>
            </div>
          ) : undefined
        }
      >
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-28 w-20 rounded-md" />
                <div className="flex-1 space-y-2 py-1">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-9 w-28" />
                </div>
              </div>
            ))}
          </div>
        )}

        {isEmpty && (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-surface text-muted" aria-hidden>
              <ShoppingBag className="h-6 w-6" />
            </div>
            <p className="font-serif text-lg">Your bag is empty</p>
            <p className="mt-1.5 text-sm text-muted">Add something classy to get started.</p>
            <Button asChild size="lg" className="mt-6" onClick={() => onOpenChange(false)}>
              <Link href="/shop">Browse collection</Link>
            </Button>
          </div>
        )}

        {!isEmpty && cart && (
          <div className="space-y-5">
            {pricing && <FreeShippingMeter pricing={pricing} compact />}

            <ul className="divide-y divide-line">
              {cart.lines.map((line) => (
                <li key={line.id} className="flex gap-3 py-4 first:pt-0">
                  <Link
                    href={`/product/${line.slug}`}
                    onClick={() => onOpenChange(false)}
                    className="relative h-28 w-20 shrink-0 overflow-hidden rounded-md bg-surface"
                  >
                    {line.image ? (
                      <Image src={line.image} alt={line.name} fill sizes="80px" className="object-cover" />
                    ) : (
                      <span className="grid h-full place-items-center text-2xs text-faint">No image</span>
                    )}
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/product/${line.slug}`}
                          onClick={() => onOpenChange(false)}
                          className="line-clamp-2-safe text-sm text-ink hover:underline"
                        >
                          {line.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted">{line.variantLabel}</p>
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
                        className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-surface hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>

                    {line.issue === 'OUT_OF_STOCK' && (
                      <p className="mt-1 text-xs text-danger">Sold out — remove to continue.</p>
                    )}
                    {line.issue === 'QUANTITY_REDUCED' && (
                      <p className="mt-1 text-xs text-gold-ink">Only {line.maxQuantity} left; quantity updated.</p>
                    )}

                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <div className="flex items-center rounded-md border border-ink/15">
                        <button
                          type="button"
                          onClick={() => updateItem.mutate({ itemId: line.id, quantity: line.quantity - 1 })}
                          disabled={updateItem.isPending}
                          aria-label={`Decrease quantity of ${line.name}`}
                          className="grid h-9 w-9 place-items-center text-ink transition-colors hover:bg-surface disabled:opacity-40"
                        >
                          <Minus className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <span className="min-w-8 text-center text-sm tabular-nums" aria-live="polite">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateItem.mutate({ itemId: line.id, quantity: line.quantity + 1 })}
                          disabled={updateItem.isPending || line.quantity >= line.maxQuantity}
                          aria-label={`Increase quantity of ${line.name}`}
                          className="grid h-9 w-9 place-items-center text-ink transition-colors hover:bg-surface disabled:opacity-40"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>

                      <p className="text-sm font-medium tabular-nums">{formatPaise(line.lineTotalPaise)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Coupon */}
            <div className="rounded-md border border-line p-3">
              {pricing?.coupon ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-success">{pricing.coupon.code} applied</p>
                    <p className="text-xs text-muted">
                      You saved {formatPaise(pricing.coupon.discountPaise)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCoupon.mutate()}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-faint hover:bg-surface hover:text-ink"
                    aria-label="Remove coupon"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (couponInput.trim()) applyCoupon.mutate(couponInput.trim());
                  }}
                  className="flex gap-2"
                >
                  <label htmlFor="cart-coupon" className="sr-only">Coupon code</label>
                  <Input
                    id="cart-coupon"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Coupon code"
                    className="h-10 flex-1 uppercase"
                    autoComplete="off"
                  />
                  <Button type="submit" variant="outline" size="sm" className="h-10" loading={applyCoupon.isPending}>
                    Apply
                  </Button>
                </form>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
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
