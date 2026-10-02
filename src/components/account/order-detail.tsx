'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea, Field } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { OrderStatusBadge } from './order-status-badge';
import { formatPaise } from '@/lib/money';
import { formatDate, formatDateTime } from '@/lib/utils';
import type { OrderDTO } from '@/types';

/** Full order view: items, totals, tracking timeline, cancel/return actions. */
export function OrderDetail({ order }: { order: OrderDTO }) {
  const router = useRouter();
  const { toast } = useToast();
  const [action, setAction] = React.useState<'cancel' | 'return' | null>(null);
  const [reason, setReason] = React.useState('');
  const [pending, setPending] = React.useState(false);

  const submit = async () => {
    if (!action) return;
    setPending(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? 'Could not complete that request.');

      toast({
        title: action === 'cancel' ? 'Order cancelled' : 'Return requested',
        variant: 'success',
      });
      setAction(null);
      setReason('');
      router.refresh();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Something went wrong.', variant: 'error' });
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl">{order.orderNumber}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="mt-1.5 text-sm text-muted">
          Placed {formatDate(order.placedAt, 'long')} · {order.paymentMethod === 'COD' ? 'Cash on delivery' : 'Paid online'}
        </p>
      </header>

      {/* ── Tracking ─────────────────────────────────────────────────── */}
      {order.shipment && (
        <section className="mb-6 rounded-lg border border-line p-5" aria-labelledby="tracking">
          <h2 id="tracking" className="mb-3 flex items-center gap-2 font-serif text-lg">
            <Truck className="h-4 w-4 text-muted" aria-hidden />
            Shipment
          </h2>
          <dl className="grid gap-2.5 text-sm sm:grid-cols-2">
            {order.shipment.courierName && <Pair label="Courier" value={order.shipment.courierName} />}
            {order.shipment.awbCode && <Pair label="AWB number" value={order.shipment.awbCode} />}
            {order.shipment.expectedDelivery && (
              <Pair label="Expected by" value={formatDate(order.shipment.expectedDelivery, 'long')} />
            )}
            {order.shipment.deliveredAt && (
              <Pair label="Delivered" value={formatDate(order.shipment.deliveredAt, 'long')} />
            )}
          </dl>
          {order.shipment.trackingUrl && (
            <a
              href={order.shipment.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide2 text-gold-ink underline underline-offset-4"
            >
              Track with courier
              <ExternalLink className="h-3 w-3" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </section>
      )}

      {/* ── Timeline ─────────────────────────────────────────────────── */}
      {order.timeline.length > 0 && (
        <section className="mb-6 rounded-lg border border-line p-5" aria-labelledby="timeline">
          <h2 id="timeline" className="mb-4 font-serif text-lg">Order timeline</h2>
          <ol className="space-y-4">
            {order.timeline.map((event, i) => (
              <li key={i} className="relative flex gap-3.5 pl-1">
                <span className="relative flex flex-col items-center" aria-hidden>
                  <span className={`h-2.5 w-2.5 rounded-full ${i === order.timeline.length - 1 ? 'bg-ink' : 'bg-ink/25'}`} />
                  {i < order.timeline.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
                </span>
                <span className="pb-1">
                  <span className="block text-sm text-ink">{event.message ?? event.status}</span>
                  <span className="mt-0.5 block text-xs text-faint">{formatDateTime(event.at)}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── Items ────────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-line" aria-labelledby="items">
        <h2 id="items" className="border-b border-line p-5 font-serif text-lg">Items</h2>
        <ul className="divide-y divide-line">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-4 p-5">
              <span className="relative h-24 shrink-0 overflow-hidden rounded-md bg-surface" style={{ width: 72 }}>
                {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="72px" className="object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                {item.slug ? (
                  <Link href={`/product/${item.slug}`} className="text-sm text-ink hover:underline">{item.productName}</Link>
                ) : (
                  <span className="text-sm text-ink">{item.productName}</span>
                )}
                <span className="mt-1 block text-xs text-muted">{item.variantLabel} · Qty {item.quantity}</span>
                <span className="mt-0.5 block text-2xs text-faint">SKU {item.sku}</span>
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
      </section>

      {order.address && (
        <section className="mt-6 rounded-lg border border-line p-5">
          <h2 className="mb-3 font-serif text-lg">Delivery address</h2>
          <address className="text-sm not-italic leading-relaxed text-muted">
            <span className="block text-ink">{order.address.fullName}</span>
            {order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ''}<br />
            {order.address.city}, {order.address.state} {order.address.pincode}<br />
            {order.address.phone}
          </address>
        </section>
      )}

      {(order.canCancel || order.canReturn) && (
        <div className="mt-6 flex flex-wrap gap-3">
          {order.canCancel && (
            <Button variant="outline" onClick={() => setAction('cancel')}>Cancel order</Button>
          )}
          {order.canReturn && (
            <Button variant="outline" onClick={() => setAction('return')}>Request return</Button>
          )}
        </div>
      )}

      <Sheet open={action !== null} onOpenChange={(open) => !open && setAction(null)}>
        <SheetContent
          side="bottom"
          title={action === 'cancel' ? 'Cancel this order' : 'Request a return'}
          description={
            action === 'cancel'
              ? 'Tell us why so we can improve. This cannot be undone.'
              : 'Tell us what went wrong and we will get back to you.'
          }
          className="lg:mx-auto lg:max-w-md"
          footer={
            <Button full size="lg" loading={pending} onClick={submit} disabled={action === 'return' && reason.trim().length < 3}>
              {action === 'cancel' ? 'Cancel order' : 'Submit request'}
            </Button>
          }
        >
          <Field
            label="Reason"
            htmlFor="reason"
            required={action === 'return'}
            hint={action === 'cancel' ? 'Optional' : undefined}
          >
            <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
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
