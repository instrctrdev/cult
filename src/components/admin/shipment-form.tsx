'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Package, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Field, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import type { ShipmentStatus } from '@/types';

export interface ShipmentFormValues {
  courierName: string;
  awbCode: string;
  trackingUrl: string;
  expectedDelivery: string;
  status: ShipmentStatus;
  notes: string;
}

/**
 * Manual tracking entry.
 *
 * Fulfilment happens outside this system, so staff key in what the courier
 * gave them. Saving records the shipment, advances the order status and
 * appends to the timeline the customer sees in their account.
 */
export function ShipmentForm({
  orderId,
  initial,
  statuses,
  hasShipment,
}: {
  orderId: string;
  initial: ShipmentFormValues;
  statuses: { value: ShipmentStatus; label: string }[];
  hasShipment: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<ShipmentFormValues>({ defaultValues: initial });

  return (
    <section className="rounded-lg border border-line" aria-labelledby="shipment-heading">
      <div className="border-b border-line p-5">
        <h2 id="shipment-heading" className="flex items-center gap-2 font-serif text-lg">
          <Truck className="h-4 w-4 text-muted" aria-hidden />
          Shipping &amp; tracking
        </h2>
        <p className="mt-1 text-xs text-muted">
          Enter the details from your courier. The customer sees this in their account and on the
          order tracking page.
        </p>
      </div>

      <form
        className="space-y-4 p-5"
        onSubmit={form.handleSubmit(async (values) => {
          setError(null);
          try {
            const res = await fetch(`/api/admin/orders/${orderId}/shipment`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                courierName: values.courierName || null,
                awbCode: values.awbCode || null,
                trackingUrl: values.trackingUrl || null,
                expectedDelivery: values.expectedDelivery || null,
                status: values.status,
                notes: values.notes || null,
              }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error?.message ?? 'Could not save tracking details.');

            toast({ title: 'Tracking updated', variant: 'success' });
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save tracking details.');
          }
        })}
      >
        {error && <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Shipping provider" htmlFor="courierName" hint="e.g. Delhivery, Blue Dart, India Post">
            <Input placeholder="Courier name" {...form.register('courierName')} />
          </Field>

          <Field label="Tracking number" htmlFor="awbCode" hint="AWB or consignment number">
            <Input placeholder="e.g. 1234567890" {...form.register('awbCode')} />
          </Field>

          <Field label="Tracking URL" htmlFor="trackingUrl" hint="Optional — links the customer straight to the courier">
            <Input type="url" placeholder="https://…" {...form.register('trackingUrl')} />
          </Field>

          <Field label="Estimated delivery" htmlFor="expectedDelivery">
            <Input type="date" {...form.register('expectedDelivery')} />
          </Field>
        </div>

        <Field label="Shipment status" htmlFor="status" hint="Changing this also updates the customer's order status">
          <select
            id="status"
            className="h-12 w-full rounded-md border border-ink/15 bg-bg px-3 text-ink transition-colors hover:border-ink/25 focus:border-ink"
            {...form.register('status')}
          >
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Internal note" htmlFor="notes" hint="Staff only — never shown to the customer">
          <Textarea rows={2} {...form.register('notes')} />
        </Field>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={form.formState.isSubmitting}>
            <Package className="h-4 w-4" aria-hidden />
            {hasShipment ? 'Update tracking' : 'Save tracking'}
          </Button>

          {hasShipment && (
            <Button
              type="button"
              variant="ghost"
              className="text-muted hover:text-danger"
              onClick={async () => {
                const res = await fetch(`/api/admin/orders/${orderId}/shipment`, { method: 'DELETE' });
                toast(
                  res.ok
                    ? { title: 'Shipment cancelled', variant: 'success' }
                    : { title: 'Could not cancel the shipment.', variant: 'error' },
                );
                router.refresh();
              }}
            >
              Cancel shipment
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
