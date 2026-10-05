import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { formatPaise, toPaise } from '@/lib/money';
import { ReceiptPrint } from '@/components/admin/receipt-print';

export const dynamic = 'force-dynamic';

export default async function OfflineReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('orders.read');
  const { id } = await params;
  const [sale, settings] = await Promise.all([
    prisma.offlineSale.findUnique({ where: { id }, include: { items: true } }), getSettings(),
  ]);
  if (!sale) notFound();
  const address = [settings['store.address_line1'], settings['store.address_line2'], settings['store.city'], settings['store.state'], settings['store.pincode']].filter(Boolean).join(', ');
  const saved = sale.items.reduce((sum, item) => sum + (toPaise(item.mrp) - toPaise(item.unitPrice)) * item.quantity, 0) + toPaise(sale.couponDiscount) + toPaise(sale.manualDiscount);
  return <div className="space-y-4"><div className="print-hide flex items-center justify-between"><Link href="/admin/offline-sales" className="text-sm underline">← Offline billing</Link><ReceiptPrint /></div>
    <article className="receipt-paper mx-auto w-[80mm] border border-line bg-white p-4 font-mono text-[11px] leading-5 text-black">
      <header className="text-center"><h1 className="text-lg font-bold uppercase">{settings['store.legal_name'] || 'CULT Clothing'}</h1>
        {address && <p>{address}</p>}{settings['store.phone'] && <p>Ph: {settings['store.phone']}</p>}{settings['store.gstin'] && <p>GSTIN: {settings['store.gstin']}</p>}
        <p className="mt-3 font-bold uppercase">Sales receipt</p></header>
      <div className="my-3 border-y border-dashed border-black py-2"><p>Receipt: {sale.receiptNumber}</p><p>Date: {sale.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
        {sale.customerName && <p>Customer: {sale.customerName}</p>}{sale.customerPhone && <p>Phone: {sale.customerPhone}</p>}</div>
      <div className="border-b border-dashed border-black pb-2"><div className="flex justify-between font-bold"><span>Item / Qty × Rate</span><span>Amount</span></div>
        {sale.items.map((item) => <div key={item.id} className="mt-2"><p className="break-words">{item.productName}{item.variantLabel ? ` (${item.variantLabel})` : ''}</p>
          <div className="flex justify-between"><span>{item.quantity} × {formatPaise(toPaise(item.unitPrice))}</span><span>{formatPaise(toPaise(item.lineTotal))}</span></div></div>)}
      </div>
      <div className="space-y-1 border-b border-dashed border-black py-2"><div className="flex justify-between"><span>Subtotal</span><span>{formatPaise(toPaise(sale.subtotal))}</span></div>
        {sale.couponCode && <div className="flex justify-between"><span>Coupon {sale.couponCode}</span><span>-{formatPaise(toPaise(sale.couponDiscount))}</span></div>}
        {toPaise(sale.manualDiscount) > 0 && <div className="flex justify-between"><span>Additional discount ({Number(sale.manualDiscountPercent)}%)</span><span>-{formatPaise(toPaise(sale.manualDiscount))}</span></div>}
        {toPaise(sale.roundOff) !== 0 && <div className="flex justify-between"><span>Round off</span><span>{formatPaise(toPaise(sale.roundOff))}</span></div>}
        <div className="flex justify-between text-sm font-bold"><span>Total</span><span>{formatPaise(toPaise(sale.grandTotal))}</span></div></div>
      <p className="mt-2">Paid by {sale.paymentMethod.toLowerCase()}</p><p>You saved: {formatPaise(saved)}</p><p className="mt-5 text-center">Thanks for shopping with us!</p>
    </article>
  </div>;
}
