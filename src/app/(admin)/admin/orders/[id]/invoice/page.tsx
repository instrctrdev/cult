import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/session';
import { OrderService } from '@/services/order.service';
import { getSettings } from '@/lib/settings';
import { PrintDocument } from '@/components/admin/print-document';
import { formatPaise } from '@/lib/money';
import { formatDateTime } from '@/lib/utils';
import { BRAND } from '@/lib/brand';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tax invoice', robots: { index: false, follow: false } };

/**
 * Tax invoice for a confirmed order.
 *
 * Every figure is read from the order as stored, which is the amount actually
 * charged — an invoice that disagrees with the customer's bank statement is
 * worse than none. Tax shows as zero while the store has tax switched off in
 * settings, rather than being invented to fill the column.
 */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('orders.read');
  const { id } = await params;

  const [order, settings] = await Promise.all([OrderService.getById(id), getSettings()]);
  if (!order) notFound();

  const address = order.address;
  const seller = {
    name: String(settings['store.legal_name'] || BRAND.name),
    line1: String(settings['store.address_line1'] || ''),
    line2: String(settings['store.address_line2'] || ''),
    city: String(settings['store.city'] || ''),
    state: String(settings['store.state'] || ''),
    pincode: String(settings['store.pincode'] || ''),
    email: String(settings['store.email'] || BRAND.email),
    phone: String(settings['store.phone'] || ''),
    gstin: String(settings['store.gstin'] || ''),
  };

  return (
    <PrintDocument title={`Invoice ${order.orderNumber}`}>
      <header>
        <h1 className="font-serif text-2xl">Tax Invoice</h1>
        <p className="mt-1 text-sm text-muted">Invoice No: {order.orderNumber}</p>
        <p className="text-sm text-muted">Date: {formatDateTime(order.placedAt)}</p>
      </header>

      <section className="mt-6">
        <h2 className="text-2xs font-semibold uppercase tracking-wide2">Bill from</h2>
        <div className="mt-2 text-sm leading-relaxed">
          <p className="font-medium">{seller.name}</p>
          {seller.line1 && <p>{seller.line1}</p>}
          {seller.line2 && <p>{seller.line2}</p>}
          {(seller.city || seller.pincode || seller.state) && (
            <p>
              {[seller.city, seller.pincode].filter(Boolean).join('- ')}
              {seller.state ? `, ${seller.state}` : ''}, IN
            </p>
          )}
          {seller.email && <p>Email: {seller.email}</p>}
          {seller.phone && <p>Phone: {seller.phone}</p>}
          {/* Omitted entirely when unset — a blank GST line on a tax invoice
              looks like a missing registration rather than an unregistered seller. */}
          {seller.gstin && <p>GST Number: {seller.gstin}</p>}
        </div>
      </section>

      <div className="mt-6 grid gap-8 border-t border-line pt-6 sm:grid-cols-2">
        <section>
          <h2 className="text-2xs font-semibold uppercase tracking-wide2">Shipping address</h2>
          {address ? (
            <address className="mt-2 not-italic text-sm leading-relaxed">
              <p className="font-medium">{address.fullName}</p>
              <p>{address.line1}{address.line2 ? `, ${address.line2}` : ''}</p>
              <p>{address.city}, {address.state} - {address.pincode}</p>
              <p>{address.phone}</p>
              {order.address?.email && <p>Email: {order.address.email}</p>}
            </address>
          ) : (
            <p className="mt-2 text-sm text-muted">No delivery address on this order.</p>
          )}
        </section>

        <section>
          <h2 className="text-2xs font-semibold uppercase tracking-wide2">Billing address</h2>
          {address ? (
            <address className="mt-2 not-italic text-sm leading-relaxed">
              <p className="font-medium">{address.fullName}</p>
              <p>{address.line1}{address.line2 ? `, ${address.line2}` : ''}</p>
              <p>{address.city}, {address.state} - {address.pincode}</p>
            </address>
          ) : (
            <p className="mt-2 text-sm text-muted">—</p>
          )}
        </section>
      </div>

      <section className="mt-6 border-t border-line pt-6">
        <h2 className="text-2xs font-semibold uppercase tracking-wide2">Order details</h2>
        <div className="mt-2 space-y-0.5 text-sm">
          <p><span className="font-medium">Sales Number:</span> {order.orderNumber}</p>
          {order.shipment?.awbCode && (
            <p><span className="font-medium">AWB Number:</span> {order.shipment.awbCode}</p>
          )}
          {order.shipment?.courierName && (
            <p><span className="font-medium">Courier:</span> {order.shipment.courierName}</p>
          )}
          <p><span className="font-medium">Sale Date:</span> {formatDateTime(order.placedAt)}</p>
        </div>
      </section>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-line bg-surface/60 text-left text-2xs uppercase tracking-wide2">
            <th className="py-2.5 pr-3 font-semibold">Item description</th>
            <th className="py-2.5 pr-3 font-semibold">SKU</th>
            <th className="py-2.5 pr-3 text-right font-semibold">Qty</th>
            <th className="py-2.5 pr-3 text-right font-semibold">Rate</th>
            <th className="py-2.5 pr-3 text-right font-semibold">Taxable</th>
            <th className="py-2.5 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-line">
              <td className="py-3 pr-3">
                {item.productName}
                {item.variantLabel && <span className="block text-muted">{item.variantLabel}</span>}
              </td>
              <td className="py-3 pr-3 text-muted">{item.sku}</td>
              <td className="py-3 pr-3 text-right tabular-nums">{item.quantity}</td>
              <td className="py-3 pr-3 text-right tabular-nums">{formatPaise(item.unitPricePaise)}</td>
              <td className="py-3 pr-3 text-right tabular-nums">{formatPaise(item.lineTotalPaise)}</td>
              <td className="py-3 text-right tabular-nums">{formatPaise(item.lineTotalPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-5 flex justify-end">
        <dl className="w-full max-w-xs space-y-1.5 text-sm">
          <Row label="Subtotal" value={formatPaise(order.subtotalPaise)} />
          {order.discountPaise > 0 && (
            <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`} value={`− ${formatPaise(order.discountPaise)}`} />
          )}
          <Row label="Delivery" value={order.shippingPaise === 0 ? 'FREE' : formatPaise(order.shippingPaise)} />
          {order.handlingPaise > 0 && <Row label="Handling" value={formatPaise(order.handlingPaise)} />}
          {order.codFeePaise > 0 && <Row label="COD charge" value={formatPaise(order.codFeePaise)} />}
          <Row label="Tax" value={formatPaise(order.taxPaise)} />
          <div className="flex justify-between border-t border-ink pt-2 text-base font-medium">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatPaise(order.totalPaise)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 border-t border-line pt-4 text-sm">
        <p>
          <span className="font-medium">Payment type:</span>{' '}
          {order.paymentMethod === 'COD' ? 'Cash on delivery' : 'Prepaid'}
          {order.paymentMethod === 'COD' && order.paymentStatus !== 'PAID' && (
            <span className="text-muted"> — amount due on delivery</span>
          )}
        </p>
      </div>

      <p className="mt-8 text-center text-2xs text-faint">
        This is a computer-generated invoice and does not require a signature.
      </p>
    </PrintDocument>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
