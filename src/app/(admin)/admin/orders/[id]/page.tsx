import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { PaymentStatus } from '@prisma/client';
import { FileText, Package } from 'lucide-react';
import { requirePermission, getCurrentUser } from '@/lib/auth/session';
import { can } from '@/lib/auth/rbac';
import { OrderService } from '@/services/order.service';
import { ShippingService, MANUAL_SHIPMENT_STATUSES } from '@/services/shipping.service';
import { prisma } from '@/lib/prisma';
import { formatPaise, toPaise } from '@/lib/money';
import { formatDate, formatDateTime } from '@/lib/utils';
import { OrderStatusBadge } from '@/components/account/order-status-badge';
import { ShipmentForm } from '@/components/admin/shipment-form';
import { OrderActions } from '@/components/admin/order-actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Order' };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('orders.read');
  const user = await getCurrentUser();
  const { id } = await params;

  const [order, shipment, payment] = await Promise.all([
    OrderService.getById(id),
    ShippingService.getForOrder(id),
    prisma.payment.findFirst({ where: { orderId: id }, orderBy: { createdAt: 'desc' } }),
  ]);

  if (!order) notFound();

  const refundable = payment
    ? Math.max(0, toPaise(payment.amount) - toPaise(payment.refundedAmount))
    : 0;
  const isSettled = payment?.status === PaymentStatus.PAID || payment?.status === PaymentStatus.PARTIALLY_REFUNDED;

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <Link href="/admin/orders" className="text-2xs uppercase tracking-wide2 text-muted hover:text-ink hover:underline">
          ← Orders
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-2xl">{order.orderNumber}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {formatDate(order.placedAt, 'long')} · {order.paymentMethod === 'COD' ? 'Cash on delivery' : 'Prepaid'}
            {payment ? ` · payment ${payment.status.toLowerCase()}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="font-serif text-2xl tabular-nums">{formatPaise(order.totalPaise)}</p>

          {/*
            Only once the order is real: printing an invoice for something
            still awaiting payment invites it being packed and sent.
          */}
          {order.status !== 'PENDING' && order.status !== 'CANCELLED' && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/orders/${order.id}/invoice`}
                target="_blank"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-2xs font-medium uppercase tracking-wide2 text-ink transition-colors hover:bg-surface"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden />
                Invoice
              </Link>
              <Link
                href={`/admin/orders/${order.id}/packing-slip`}
                target="_blank"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-2xs font-medium uppercase tracking-wide2 text-ink transition-colors hover:bg-surface"
              >
                <Package className="h-3.5 w-3.5" aria-hidden />
                Packing slip
              </Link>
            </div>
          )}
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px] xl:items-start">
        <div className="space-y-5">
          {/* ── Items ─────────────────────────────────────────────────── */}
          <section className="rounded-lg border border-line">
            <h2 className="border-b border-line p-5 font-serif text-lg">Items</h2>
            <ul className="divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-4 p-4">
                  <span className="relative h-20 w-15 shrink-0 overflow-hidden rounded bg-surface" style={{ width: 60 }}>
                    {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="60px" className="object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">{item.productName}</span>
                    <span className="mt-0.5 block text-xs text-muted">{item.variantLabel}</span>
                    <span className="mt-0.5 block text-2xs text-faint">
                      SKU {item.sku} · {formatPaise(item.unitPricePaise)} × {item.quantity}
                    </span>
                  </span>
                  <span className="text-sm tabular-nums">{formatPaise(item.lineTotalPaise)}</span>
                </li>
              ))}
            </ul>

            <dl className="space-y-1.5 border-t border-line p-5 text-sm">
              <Row label="Subtotal" value={formatPaise(order.subtotalPaise)} />
              {order.discountPaise > 0 && (
                <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`} value={`− ${formatPaise(order.discountPaise)}`} />
              )}
              <Row label="Shipping" value={order.shippingPaise === 0 ? 'FREE' : formatPaise(order.shippingPaise)} />
              {order.handlingPaise > 0 && <Row label="Handling" value={formatPaise(order.handlingPaise)} />}
              {order.codFeePaise > 0 && <Row label="COD charge" value={formatPaise(order.codFeePaise)} />}
              {order.taxPaise > 0 && <Row label="Tax" value={formatPaise(order.taxPaise)} />}
              <div className="!mt-3 flex justify-between border-t border-line pt-3 font-medium">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatPaise(order.totalPaise)}</dd>
              </div>
              {payment && toPaise(payment.refundedAmount) > 0 && (
                <Row label="Refunded" value={`− ${formatPaise(toPaise(payment.refundedAmount))}`} />
              )}
            </dl>
          </section>

          {/* ── Manual tracking ───────────────────────────────────────── */}
          <ShipmentForm
            orderId={order.id}
            hasShipment={Boolean(shipment)}
            statuses={MANUAL_SHIPMENT_STATUSES}
            initial={{
              courierName: shipment?.courierName ?? '',
              awbCode: shipment?.awbCode ?? '',
              trackingUrl: shipment?.trackingUrl ?? '',
              expectedDelivery: shipment?.expectedDelivery
                ? shipment.expectedDelivery.toISOString().slice(0, 10)
                : '',
              status: shipment?.status ?? 'PENDING',
              notes: shipment?.errorMessage ?? '',
            }}
          />

          {/* ── Timeline ──────────────────────────────────────────────── */}
          <section className="rounded-lg border border-line p-5">
            <h2 className="mb-4 font-serif text-lg">Timeline</h2>
            <ol className="space-y-3.5">
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
          </section>
        </div>

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <div className="space-y-5">
          <OrderActions
            orderId={order.id}
            currentStatus={order.status}
            refundablePaise={refundable}
            canRefund={Boolean(user && can(user.role, 'orders.refund') && isSettled)}
            // Only useful while the order is still PENDING — that's the exact
            // state markPaid requires to confirm it, and the state a payment
            // left unverified (e.g. the customer closed the tab) is stuck in.
            canRecheckPayment={Boolean(
              user && can(user.role, 'orders.write') && order.paymentMethod === 'PREPAID' && order.status === 'PENDING',
            )}
          />

          <section className="rounded-lg border border-line p-5">
            <h2 className="mb-3 font-serif text-lg">Customer</h2>
            <p className="text-sm text-ink">{order.address?.fullName ?? '—'}</p>
            <p className="mt-1 break-all text-xs text-muted">{order.items.length} items</p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div>
                <dt className="text-xs text-muted">Email</dt>
                <dd className="break-all text-ink">{order.address?.email ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Phone</dt>
                <dd className="text-ink">{order.address?.phone ?? '—'}</dd>
              </div>
            </dl>
          </section>

          {order.address && (
            <section className="rounded-lg border border-line p-5">
              <h2 className="mb-3 font-serif text-lg">Delivery address</h2>
              <address className="text-sm not-italic leading-relaxed text-muted">
                <span className="block text-ink">{order.address.fullName}</span>
                {order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ''}<br />
                {order.address.landmark && <>{order.address.landmark}<br /></>}
                {order.address.city}, {order.address.state} {order.address.pincode}<br />
                {order.address.country}<br />
                {order.address.phone}
              </address>
            </section>
          )}

          {payment && (
            <section className="rounded-lg border border-line p-5">
              <h2 className="mb-3 font-serif text-lg">Payment</h2>
              <dl className="space-y-1.5 text-sm">
                <Row label="Provider" value={payment.provider} />
                <Row label="Status" value={payment.status.toLowerCase()} />
                <Row label="Amount" value={formatPaise(toPaise(payment.amount))} />
                {payment.providerPaymentId && (
                  <div>
                    <dt className="text-xs text-muted">Gateway reference</dt>
                    <dd className="break-all text-xs text-ink">{payment.providerPaymentId}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="capitalize text-muted">{label}</dt>
      <dd className="tabular-nums text-ink">{value}</dd>
    </div>
  );
}
