'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { OrderStatusBadge } from '@/components/account/order-status-badge';
import { trackOrderSchema } from '@/lib/validation';
import { formatPaise } from '@/lib/money';
import { formatDate, formatDateTime } from '@/lib/utils';
import type { OrderDTO } from '@/types';

/**
 * Guest order tracking.
 *
 * Requires order number *and* email — the API enforces the same pairing, so
 * order numbers cannot be walked.
 */
export function TrackOrderForm({ defaultOrderNumber }: { defaultOrderNumber: string }) {
  const [order, setOrder] = React.useState<OrderDTO | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<z.input<typeof trackOrderSchema>>({
    resolver: zodResolver(trackOrderSchema),
    defaultValues: { orderNumber: defaultOrderNumber, email: '' },
  });

  return (
    <>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          setError(null);
          setOrder(null);
          const res = await fetch('/api/orders/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(json?.error?.message ?? 'We could not find that order.');
            return;
          }
          setOrder(json.order as OrderDTO);
        })}
        className="mt-8 space-y-4"
      >
        <Field label="Order number" htmlFor="tr-order" required error={form.formState.errors.orderNumber?.message}>
          <Input placeholder="CU-2026-0001" autoComplete="off" className="uppercase" {...form.register('orderNumber')} />
        </Field>
        <Field label="Email" htmlFor="tr-email" required error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="email" {...form.register('email')} />
        </Field>

        {error && <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p>}

        <Button type="submit" size="xl" full loading={form.formState.isSubmitting}>
          Track order
        </Button>
      </form>

      {order && (
        <section className="mt-10 rounded-lg border border-line p-5" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-sans text-sm font-medium tracking-wide">{order.orderNumber}</h2>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-xs text-muted">
            Placed {formatDate(order.placedAt, 'long')} · {order.items.length} item
            {order.items.length === 1 ? '' : 's'} · {formatPaise(order.totalPaise)}
          </p>

          {order.shipment?.awbCode && (
            <p className="mt-4 text-sm text-muted">
              {order.shipment.courierName ?? 'Courier'} · AWB{' '}
              <strong className="text-ink">{order.shipment.awbCode}</strong>
              {order.shipment.trackingUrl && (
                <>
                  {' · '}
                  <a
                    href={order.shipment.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold-ink underline underline-offset-4"
                  >
                    Track with courier
                  </a>
                </>
              )}
            </p>
          )}

          {order.timeline.length > 0 && (
            <ol className="mt-5 space-y-3.5 border-t border-line pt-5">
              {order.timeline.map((event, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      i === order.timeline.length - 1 ? 'bg-ink' : 'bg-ink/25'
                    }`}
                    aria-hidden
                  />
                  <span>
                    <span className="block text-sm text-ink">{event.message ?? event.status}</span>
                    <span className="text-xs text-faint">{formatDateTime(event.at)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </>
  );
}
