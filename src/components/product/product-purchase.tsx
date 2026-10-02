'use client';

import * as React from 'react';
import Link from 'next/link';
import { Heart, Minus, Plus, ShieldCheck, Truck, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Price } from '@/components/ui/price';
import { useCartActions } from '@/hooks/use-cart';
import { useExpressCheckout } from '@/hooks/use-express-checkout';
import { useWishlist } from '@/hooks/use-wishlist';
import { rupees, track } from '@/lib/analytics';
import { formatPaise } from '@/lib/money';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/brand';
import { SizeGuide } from './size-guide';
import type { ProductDetailDTO } from '@/types';

/**
 * Buy box: size selection, quantity, add-to-bag, buy-now and wishlist.
 *
 * On mobile the same actions are mirrored into a sticky bottom bar (below), so
 * "Add to bag" is always reachable no matter how far the customer has scrolled.
 */
export function ProductPurchase({
  product,
  isSignedIn,
  freeShippingThresholdPaise,
  shippingFeePaise,
  freeShippingEnabled,
  prepaidFreeShipping,
}: {
  product: ProductDetailDTO;
  isSignedIn: boolean;
  freeShippingThresholdPaise: number;
  shippingFeePaise: number;
  freeShippingEnabled: boolean;
  /** Delivery waived when paying online; COD still pays `shippingFeePaise`. */
  prepaidFreeShipping: boolean;
}) {
  const { addItem } = useCartActions();
  const expressCheckout = useExpressCheckout();
  const wishlist = useWishlist({ isSignedIn });

  const inStockVariants = product.variants.filter((v) => v.inStock);
  // Preselect only when there is genuinely no choice to make.
  const [variantId, setVariantId] = React.useState<string | null>(
    product.variants.length === 1 ? product.variants[0].id : null,
  );
  const [quantity, setQuantity] = React.useState(1);
  const [showSizeError, setShowSizeError] = React.useState(false);

  const selected = product.variants.find((v) => v.id === variantId) ?? null;
  const displayPrice = selected?.pricePaise ?? product.pricePaise;
  const displayCompare = selected?.compareAtPaise ?? product.compareAtPaise;
  const soldOut = inStockVariants.length === 0;

  React.useEffect(() => {
    track({
      name: 'view_item',
      item: { id: product.id, name: product.name, price: rupees(product.pricePaise) },
    });
    // One "view_item" per product view.
  }, [product.id, product.name, product.pricePaise]);

  const maxQty = selected ? Math.min(selected.available, 10) : 10;
  React.useEffect(() => {
    setQuantity((q) => Math.min(q, Math.max(1, maxQty)));
  }, [maxQty]);

  const requireSize = () => {
    if (!selected) {
      setShowSizeError(true);
      document.getElementById('size-selector')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return false;
    }
    return true;
  };

  const addToBag = (then?: () => void) => {
    if (!requireSize() || !selected) return;
    addItem.mutate(
      {
        variantId: selected.id,
        quantity,
        meta: {
          id: product.id,
          name: product.name,
          price: rupees(selected.pricePaise),
          variant: selected.size?.label,
        },
      },
      { onSuccess: then },
    );
  };

  /**
   * "Buy now" purchases *this* item only and goes straight to Cashfree's
   * payment sheet. It deliberately does not touch the bag: adding to the bag
   * first would sweep up whatever else was already in there, which is not
   * what the button says, and would leave a stray item behind if the customer
   * abandoned payment.
   */
  const buyNow = () => {
    if (!requireSize() || !selected) return;
    void expressCheckout.start({ buyNow: { variantId: selected.id, quantity } });
  };

  const shortfall = freeShippingThresholdPaise - displayPrice * quantity;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-2">{product.categories[0]?.name ?? BRAND.name}</p>
        <h1 className="text-2xl leading-snug md:text-3xl">{product.name}</h1>
        {product.subtitle && <p className="mt-1.5 text-sm text-muted">{product.subtitle}</p>}

        <Price pricePaise={displayPrice} compareAtPaise={displayCompare} size="lg" className="mt-4" />
        <p className="mt-1 text-xs text-muted">Inclusive of all taxes</p>
      </div>

      {/* ── Size ────────────────────────────────────────────────────────── */}
      {product.variants.length > 0 && (
        <div id="size-selector">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <p className="eyebrow">
              Size{selected?.size ? <span className="ml-1.5 text-ink">{selected.size.label}</span> : ''}
            </p>
            <SizeGuide fit={product.fit} chartImage={product.sizeChartImage} />
          </div>

          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Select a size" aria-required="true">
            {product.variants.map((variant) => {
              const active = variantId === variant.id;
              return (
                <button
                  key={variant.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={!variant.inStock}
                  onClick={() => {
                    setVariantId(variant.id);
                    setShowSizeError(false);
                  }}
                  className={cn(
                    'relative h-12 min-w-14 rounded-md border px-4 text-sm transition-colors',
                    active ? 'border-ink bg-ink text-bg' : 'border-ink/20 text-ink hover:border-ink',
                    !variant.inStock && 'cursor-not-allowed border-line text-faint hover:border-line',
                  )}
                >
                  {variant.size?.label ?? 'One size'}
                  {!variant.inStock && (
                    <>
                      <span
                        className="pointer-events-none absolute inset-0 m-auto h-px w-[130%] -rotate-[24deg] bg-ink/20"
                        aria-hidden
                      />
                      <span className="sr-only"> — sold out</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {showSizeError && (
            <p role="alert" className="mt-2 text-xs text-danger">Please select a size to continue.</p>
          )}
          {selected?.isLowStock && (
            <p className="mt-2 text-xs font-medium text-gold-ink">
              Only {selected.available} left in size {selected.size?.label}.
            </p>
          )}
        </div>
      )}

      {/* ── Quantity ────────────────────────────────────────────────────── */}
      {!soldOut && (
        <div>
          <p className="eyebrow mb-2.5">Quantity</p>
          <div className="inline-flex items-center rounded-md border border-ink/15">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
              className="grid h-12 w-12 place-items-center text-ink transition-colors hover:bg-surface disabled:opacity-40"
            >
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <span className="min-w-10 text-center text-sm tabular-nums" aria-live="polite">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              disabled={quantity >= maxQty}
              aria-label="Increase quantity"
              className="grid h-12 w-12 place-items-center text-ink transition-colors hover:bg-surface disabled:opacity-40"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      {/* ── Actions (desktop / inline) ──────────────────────────────────── */}
      <div className="space-y-2.5">
        {soldOut ? (
          <Button size="xl" full disabled>Sold out</Button>
        ) : (
          <>
            <div className="flex gap-2.5">
              <Button size="xl" full loading={addItem.isPending} onClick={() => addToBag()}>
                Add to bag
              </Button>
              <Button
                size="xl"
                variant="outline"
                aria-pressed={wishlist.has(product.id)}
                aria-label={wishlist.has(product.id) ? 'Remove from wishlist' : 'Save to wishlist'}
                onClick={() =>
                  wishlist.toggle.mutate({
                    productId: product.id,
                    meta: { id: product.id, name: product.name, price: rupees(displayPrice) },
                  })
                }
                className="w-14 shrink-0 px-0"
              >
                <Heart className={cn('h-5 w-5', wishlist.has(product.id) && 'fill-danger text-danger')} aria-hidden />
              </Button>
            </div>

            <Button
              size="xl"
              variant="gold"
              full
              loading={expressCheckout.pending}
              onClick={buyNow}
            >
              Buy now
            </Button>
          </>
        )}
      </div>

      {/* ── Shipping / returns, using the store's real rules ─────────────── */}
      <ul className="space-y-2.5 border-t border-line pt-5 text-sm">
        <li className="flex items-start gap-2.5">
          <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
          <span className="text-muted">
            {/*
              The whole rule, not half of it: "free over X" alone leaves the
              shopper to discover the fee at checkout, which is where carts get
              abandoned.
            */}
            {prepaidFreeShipping ? (
              <>
                <span className="text-success">Free delivery</span> when you pay online
                {shippingFeePaise > 0 && <> — {formatPaise(shippingFeePaise)} on cash on delivery</>}
              </>
            ) : freeShippingEnabled ? (
              shortfall > 0 ? (
                <>
                  <span className="text-success">Free delivery</span> on orders over{' '}
                  {formatPaise(freeShippingThresholdPaise)} — {formatPaise(shippingFeePaise)} below that
                </>
              ) : (
                <span className="text-success">This order qualifies for free delivery</span>
              )
            ) : (
              <>Delivery {formatPaise(shippingFeePaise)}</>
            )}
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
          <span className="text-muted">
            Easy returns and exchanges — see our{' '}
            <Link href="/pages/return-exchange-policy" className="text-ink underline underline-offset-4">
              return &amp; exchange policy
            </Link>
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
          <span className="text-muted">Secure checkout · Cash on delivery available</span>
        </li>
      </ul>

      <StickyBuyBar
        product={product}
        selected={selected}
        soldOut={soldOut}
        pending={addItem.isPending}
        onAdd={() => addToBag()}
        displayPrice={displayPrice}
        displayCompare={displayCompare}
      />
    </div>
  );
}

/**
 * Mobile sticky purchase bar.
 *
 * Appears once the inline buttons scroll out of view, and sits above the tab
 * bar rather than covering it.
 */
function StickyBuyBar({
  product, selected, soldOut, pending, onAdd, displayPrice, displayCompare,
}: {
  product: ProductDetailDTO;
  selected: ProductDetailDTO['variants'][number] | null;
  soldOut: boolean;
  pending: boolean;
  onAdd: () => void;
  displayPrice: number;
  displayCompare: number | null;
}) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const target = document.getElementById('size-selector');
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cn(
        'safe-bottom fixed inset-x-0 bottom-[var(--bottom-nav-h)] z-30 border-t border-line bg-bg/97 px-4 py-3 backdrop-blur-md transition-transform duration-300 lg:hidden',
        visible ? 'translate-y-0' : 'translate-y-full',
      )}
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted">{product.name}</p>
          <Price pricePaise={displayPrice} compareAtPaise={displayCompare} size="sm" showDiscount={false} />
        </div>
        <Button
          size="lg"
          className="shrink-0"
          disabled={soldOut || !visible}
          loading={pending}
          onClick={onAdd}
        >
          {soldOut ? 'Sold out' : selected ? 'Add to bag' : 'Select size'}
        </Button>
      </div>
    </div>
  );
}
