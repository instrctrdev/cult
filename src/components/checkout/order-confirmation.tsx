'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertCircle, Check, Package, Truck, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPaise } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import { rupees, track } from '@/lib/analytics';
import type { OrderDTO } from '@/types';

/**
 * Post-order screen.
 *
 * Payment state is whatever the server verified — a prepaid order that has not
 * settled says so explicitly rather than showing a green tick it has not
 * earned.
 */
export function OrderConfirmation({ order, isSignedIn }: { order: OrderDTO; isSignedIn: boolean }) {
  const paid = order.paymentStatus === 'PAID';
  const isCod = order.paymentMethod === 'COD';
  const confirmedOrder = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.status);
  // `markPaymentFailed` cancels the order and releases its stock the moment
  // the gateway reports a failure — this is not a transient "still waiting"
  // state, so it needs its own message rather than falling into the
  // reassuring "payment pending" copy below.
  const paymentFailed = !isCod && !paid && order.status === 'CANCELLED';
  const awaitingPayment = !isCod && !paid && !paymentFailed;

  React.useEffect(() => {
    if (!confirmedOrder || (!paid && !isCod)) return;

    // Confirmation URLs can be refreshed, reopened from order history, or
    // restored by the browser. None of those is another sale. Meta also
    // deduplicates against CAPI with the order number, but keeping the browser
    // from sending repeats makes Pixel diagnostics and every other provider
    // truthful too.
    const storageKey = `cult:purchase:${order.orderNumber}`;
    try {
      if (window.localStorage.getItem(storageKey)) return;
    } catch {
      // Tracking still works when storage is blocked; Meta's eventID remains
      // the cross-channel duplicate guard.
    }

    track({
      name: 'purchase',
      orderNumber: order.orderNumber,
      value: rupees(order.totalPaise),
      shipping: rupees(order.shippingPaise),
      tax: rupees(order.taxPaise),
      coupon: order.couponCode ?? undefined,
      items: order.items.map((i) => ({
        id: i.productId ?? i.sku,
        name: i.productName,
        price: rupees(i.unitPricePaise),
        quantity: i.quantity,
        variant: i.variantLabel ?? undefined,
      })),
    });

    try {
      window.localStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      // See the storage note above.
    }
    // A purchase must be reported exactly once per order, so this is keyed on
    // the order number and settlement state rather than the whole object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.orderNumber, paid, isCod, confirmedOrder]);

  return (
    <div className="container max-w-3xl py-10 lg:py-16">
      <div className="text-center">
        <span
          className={`mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full ${
            paymentFailed
              ? 'bg-danger/10 text-danger'
              : awaitingPayment
                ? 'bg-gold/10 text-gold-ink'
                : 'bg-success/10 text-success'
          }`}
          aria-hidden
        >
          {paymentFailed ? (
            <XCircle className="h-8 w-8" />
          ) : awaitingPayment ? (
            <AlertCircle className="h-8 w-8" />
          ) : (
            <Check className="h-8 w-8" strokeWidth={2.5} />
          )}
        </span>

        <h1 className="text-3xl">
          {paymentFailed ? 'Payment failed — order not placed' : awaitingPayment ? 'Order placed — payment pending' : 'Thank you for your order'}
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm text-muted text-pretty">
          {paymentFailed
            ? 'Your payment did not go through, so this order was not placed and nothing was reserved. Please try again — your bag is exactly as you left it.'
            : awaitingPayment
              ? 'We have reserved your items. This order will be confirmed as soon as your payment is verified. If money has left your account, it will be matched automatically.'
              : isCod
                ? 'Your order is confirmed. Please keep the exact amount ready for the delivery partner.'
                : 'Your payment is confirmed and your order is being prepared.'}
        </p>

        {!paymentFailed && (
          <p className="mt-5 inline-flex items-center gap-2 rounded-md bg-surface px-4 py-2.5 text-sm">
            <span className="text-muted">Order number</span>
            <strong className="font-sans tracking-wide">{order.orderNumber}</strong>
          </p>
        )}
      </div>

      {!paymentFailed && (
        <>
          <div className="mt-10 rounded-lg border border-line">
            <div className="border-b border-line p-5">
              <h2 className="font-serif text-lg">Order summary</h2>
              <p className="mt-0.5 text-xs text-muted">Placed {formatDate(order.placedAt, 'long')}</p>
            </div>

            <ul className="divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-4 p-5">
                  <span className="relative h-24 w-18 shrink-0 overflow-hidden rounded-md bg-surface" style={{ width: 72 }}>
                    {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="72px" className="object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    {item.slug ? (
                      <Link href={`/product/${item.slug}`} className="text-sm text-ink hover:underline">
                        {item.productName}
                      </Link>
                    ) : (
                      <span className="text-sm text-ink">{item.productName}</span>
                    )}
                    <span className="mt-1 block text-xs text-muted">
                      {item.variantLabel} · Qty {item.quantity}
                    </span>
                  </span>
                  <span className="text-sm tabular-nums">{formatPaise(item.lineTotalPaise)}</span>
                </li>
              ))}
            </ul>

            <dl className="space-y-2 border-t border-line p-5 text-sm">
              <Row label="Subtotal" value={formatPaise(order.subtotalPaise)} />
              {order.discountPaise > 0 && (
                <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`} value={`− ${formatPaise(order.discountPaise)}`} />
              )}
              <Row label="Shipping" value={order.shippingPaise === 0 ? 'FREE' : formatPaise(order.shippingPaise)} />
              {order.handlingPaise > 0 && <Row label="Handling" value={formatPaise(order.handlingPaise)} />}
              {order.codFeePaise > 0 && <Row label="COD charge" value={formatPaise(order.codFeePaise)} />}
              {order.taxPaise > 0 && <Row label="Tax" value={formatPaise(order.taxPaise)} />}
              <div className="!mt-3 flex items-baseline justify-between border-t border-line pt-3">
                <dt className="font-medium">Total</dt>
                <dd className="font-sans text-lg font-medium tabular-nums">{formatPaise(order.totalPaise)}</dd>
              </div>
            </dl>
          </div>

          {order.address && (
            <div className="mt-6 rounded-lg border border-line p-5">
              <h2 className="mb-3 flex items-center gap-2 font-serif text-lg">
                <Truck className="h-4 w-4 text-muted" aria-hidden />
                Delivering to
              </h2>
              <address className="text-sm not-italic leading-relaxed text-muted">
                <span className="block text-ink">{order.address.fullName}</span>
                {order.address.line1}
                {order.address.line2 ? `, ${order.address.line2}` : ''}<br />
                {order.address.city}, {order.address.state} {order.address.pincode}<br />
                {order.address.country}<br />
                {order.address.phone}
              </address>
            </div>
          )}
        </>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        {paymentFailed ? (
          <Button asChild size="lg">
            <Link href="/cart">Try again</Link>
          </Button>
        ) : (
          <Button asChild size="lg">
            <Link href={isSignedIn ? '/account/orders' : `/track-order?order=${order.orderNumber}`}>
              <Package className="h-4 w-4" aria-hidden />
              Track this order
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" size="lg">
          <Link href="/shop">Continue shopping</Link>
        </Button>
      </div>

      {!isSignedIn && !paymentFailed && (
        <p className="mt-6 text-center text-xs text-muted">
          Save your order number — you will need it, along with your email, to track this order.
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums text-ink">{value}</dd>
    </div>
  );
}
