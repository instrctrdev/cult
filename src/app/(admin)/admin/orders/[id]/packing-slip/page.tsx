import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/session';
import { OrderService } from '@/services/order.service';
import { PrintDocument } from '@/components/admin/print-document';
import { formatDate } from '@/lib/utils';
import { BRAND } from '@/lib/brand';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Packing slip', robots: { index: false, follow: false } };

/**
 * Packing slip — what goes in the parcel.
 *
 * Deliberately without prices: this sheet travels with the goods, and a COD
 * parcel arriving with a paid-looking invoice inside causes arguments at the
 * door. The money side lives on the tax invoice instead.
 */
export default async function PackingSlipPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('orders.read');
  const { id } = await params;
  const order = await OrderService.getById(id);
  if (!order) notFound();

  const address = order.address;
  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <PrintDocument title={`Packing slip ${order.orderNumber}`}>
      <header className="flex items-start justify-between gap-6">
        <p className="font-display text-2xl font-bold tracking-luxe">{BRAND.name}</p>
        <div className="text-right text-sm">
          <p className="font-medium">Order {order.orderNumber}</p>
          <p className="text-muted">{formatDate(order.placedAt, 'long')}</p>
        </div>
      </header>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className="text-2xs font-semibold uppercase tracking-wide2">Ship to</h2>
          {address ? (
            <address className="mt-2 not-italic text-sm leading-relaxed">
              <span className="block">{address.fullName}</span>
              <span className="block">{address.line1}</span>
              {address.line2 && <span className="block">{address.line2}</span>}
              {address.landmark && <span className="block">{address.landmark}</span>}
              <span className="block">
                {address.pincode} {address.city} {address.state}
              </span>
              <span className="block">{address.country}</span>
              <span className="block">{address.phone}</span>
            </address>
          ) : (
            <p className="mt-2 text-sm text-muted">No delivery address on this order.</p>
          )}
        </section>

        <section>
          <h2 className="text-2xs font-semibold uppercase tracking-wide2">Bill to</h2>
          {address ? (
            <address className="mt-2 not-italic text-sm leading-relaxed">
              <span className="block">{address.fullName}</span>
              <span className="block">{address.line1}</span>
              {address.line2 && <span className="block">{address.line2}</span>}
              <span className="block">
                {address.pincode} {address.city} {address.state}
              </span>
              <span className="block">{address.country}</span>
            </address>
          ) : (
            <p className="mt-2 text-sm text-muted">—</p>
          )}
        </section>
      </div>

      <div className="mt-8 border-t-2 border-ink pt-4">
        <div className="flex items-center justify-between text-2xs font-semibold uppercase tracking-wide2">
          <span>Items</span>
          <span>Quantity</span>
        </div>

        <ul className="mt-4 divide-y divide-line">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 py-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- print needs a plain img, not an optimised one */}
              <img
                src={item.imageUrl ?? '/images/placeholder-product.svg'}
                alt=""
                width={56}
                height={72}
                className="h-[72px] w-14 shrink-0 rounded-sm object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{item.productName}</p>
                {item.variantLabel && <p className="text-sm text-muted">{item.variantLabel}</p>}
                <p className="mt-0.5 text-2xs text-faint">SKU {item.sku}</p>
              </div>
              <p className="shrink-0 text-sm tabular-nums">
                {item.quantity} of {itemCount}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 border-t-2 border-ink pt-4 text-2xs text-muted">
        <p>
          {order.paymentMethod === 'COD'
            ? 'Cash on delivery — collect payment before handing over.'
            : 'Prepaid — nothing to collect on delivery.'}
        </p>
      </div>
    </PrintDocument>
  );
}
