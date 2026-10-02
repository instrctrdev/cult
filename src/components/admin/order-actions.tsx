'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Field, Textarea } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { formatPaise } from '@/lib/money';
import type { OrderStatus } from '@/types';

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'RETURN_REQUESTED', label: 'Return requested' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'REFUNDED', label: 'Refunded' },
];

/** Status override and refund controls on the admin order screen. */
export function OrderActions({
  orderId,
  currentStatus,
  refundablePaise,
  canRefund,
  canRecheckPayment,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  refundablePaise: number;
  canRefund: boolean;
  /** Prepaid order whose payment has not settled — worth re-verifying with the gateway. */
  canRecheckPayment: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = React.useState<OrderStatus>(currentStatus);
  const [message, setMessage] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [rechecking, setRechecking] = React.useState(false);
  const [refundOpen, setRefundOpen] = React.useState(false);
  const [refundAmount, setRefundAmount] = React.useState(String(refundablePaise / 100));
  const [refundReason, setRefundReason] = React.useState('');

  const recheckPayment = async () => {
    setRechecking(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/recheck-payment`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? 'Could not recheck payment.');

      toast({
        title: json.settled
          ? 'Payment confirmed — order updated'
          : `Gateway reports: ${String(json.status).toLowerCase()}`,
        variant: json.settled ? 'success' : 'info',
      });
      router.refresh();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Recheck failed.', variant: 'error' });
    } finally {
      setRechecking(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, message: message || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? 'Could not update the status.');

      toast({ title: 'Order status updated', variant: 'success' });
      setMessage('');
      router.refresh();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Update failed.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border border-line p-5">
      <h2 className="mb-4 font-serif text-lg">Order status</h2>

      <div className="space-y-3">
        <Field label="Status" htmlFor="order-status">
          <select
            id="order-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as OrderStatus)}
            className="h-12 w-full rounded-md border border-ink/15 bg-bg px-3 text-ink hover:border-ink/25 focus:border-ink"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Note for the timeline" htmlFor="status-message" hint="Shown to the customer">
          <Textarea
            id="status-message"
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Optional"
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} loading={saving} disabled={status === currentStatus && !message}>
            Update status
          </Button>

          {canRefund && refundablePaise > 0 && (
            <Button variant="outline" onClick={() => setRefundOpen(true)}>
              Refund ({formatPaise(refundablePaise)})
            </Button>
          )}

          {canRecheckPayment && (
            <Button variant="outline" onClick={recheckPayment} loading={rechecking}>
              Recheck payment
            </Button>
          )}
        </div>

        {canRecheckPayment && (
          <p className="text-xs text-muted">
            Re-verifies with the payment gateway directly — use this if a customer paid but the
            order is still showing pending, e.g. because they closed the tab before it confirmed.
          </p>
        )}

        {status === 'CANCELLED' && currentStatus !== 'CANCELLED' && (
          <p className="rounded-md bg-gold/10 p-3 text-xs text-gold-ink">
            Cancelling returns stock and releases any coupon redemption. This cannot be undone.
          </p>
        )}
      </div>

      <Sheet open={refundOpen} onOpenChange={setRefundOpen}>
        <SheetContent
          side="bottom"
          title="Refund payment"
          description="Processed through the payment gateway."
          className="lg:mx-auto lg:max-w-md"
          footer={
            <Button
              full
              size="lg"
              onClick={async () => {
                const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ amount: Number(refundAmount), reason: refundReason || undefined }),
                });
                const json = await res.json().catch(() => ({}));
                toast(
                  res.ok
                    ? { title: 'Refund submitted', variant: 'success' }
                    : { title: json?.error?.message ?? 'Refund failed.', variant: 'error' },
                );
                if (res.ok) {
                  setRefundOpen(false);
                  router.refresh();
                }
              }}
            >
              Refund {formatPaise(Number(refundAmount || 0) * 100)}
            </Button>
          }
        >
          <div className="space-y-4 pb-4">
            <Field label="Amount (Rs.)" htmlFor="refund-amount" hint={`Up to ${formatPaise(refundablePaise)}`}>
              <Input
                id="refund-amount"
                type="number"
                min={1}
                max={refundablePaise / 100}
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
            </Field>
            <Field label="Reason" htmlFor="refund-reason">
              <Textarea
                id="refund-reason"
                rows={2}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </Field>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
