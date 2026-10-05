import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { formatPaise, toPaise } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function OfflineSaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('orders.read');
  const { id } = await params;
  const sale = await prisma.offlineSale.findUnique({ where: { id }, include: { items: true } });
  if (!sale) notFound();

  return <div className="space-y-6">
    <Link href="/admin/offline-sales" className="text-sm text-muted underline">← Offline billing</Link>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="font-serif text-2xl">{sale.receiptNumber}</h1><p className="mt-1 text-sm text-muted">{sale.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p></div>
      <Link href={`/admin/offline-sales/${sale.id}/receipt`} target="_blank" className="rounded bg-ink px-4 py-2 text-sm font-semibold text-white">Print receipt</Link>
    </header>
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="rounded-lg border border-line bg-white">
        <h2 className="border-b border-line p-5 font-serif text-lg">Items bought</h2>
        <ul className="divide-y divide-line">{sale.items.map((item) => <li key={item.id} className="flex gap-4 p-4">
          <span className="relative h-20 w-16 shrink-0 overflow-hidden rounded bg-surface">{item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="64px" className="object-cover" />}</span>
          <span className="min-w-0 flex-1"><strong className="block">{item.productName}</strong><span className="block text-sm text-muted">{item.brand}{item.variantLabel ? ` · ${item.variantLabel}` : ''}</span><span className="block text-xs text-muted">SKU {item.sku}</span><span className="mt-1 block text-sm">{item.quantity} × {formatPaise(toPaise(item.unitPrice))}</span></span>
          <strong className="text-sm">{formatPaise(toPaise(item.lineTotal))}</strong>
        </li>)}</ul>
      </section>
      <div className="space-y-5">
        <section className="rounded-lg border border-line bg-white p-5 text-sm"><h2 className="font-serif text-lg">Customer</h2><p className="mt-3 font-medium">{sale.customerName || 'Walk-in customer'}</p>{sale.customerPhone && <Link href={`/admin/offline-customers/${sale.customerPhone}`} className="mt-1 block underline">{sale.customerPhone}</Link>}</section>
        <section className="rounded-lg border border-line bg-white p-5 text-sm"><h2 className="font-serif text-lg">Payment</h2><dl className="mt-3 space-y-2">
          <div className="flex justify-between"><dt>Mode</dt><dd className="font-semibold">{sale.paymentMethod}</dd></div>
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPaise(toPaise(sale.subtotal))}</dd></div>
          <div className="flex justify-between"><dt>Coupon {sale.couponCode ? `(${sale.couponCode})` : ''}</dt><dd>-{formatPaise(toPaise(sale.couponDiscount))}</dd></div>
          <div className="flex justify-between"><dt>Discount ({Number(sale.manualDiscountPercent)}%)</dt><dd>-{formatPaise(toPaise(sale.manualDiscount))}</dd></div>
          <div className="flex justify-between"><dt>Round off</dt><dd>{formatPaise(toPaise(sale.roundOff))}</dd></div>
          <div className="flex justify-between border-t border-line pt-3 text-lg font-semibold"><dt>Total paid</dt><dd>{formatPaise(toPaise(sale.grandTotal))}</dd></div>
        </dl></section>
      </div>
    </div>
  </div>;
}
