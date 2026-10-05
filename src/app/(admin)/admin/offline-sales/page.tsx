import Link from 'next/link';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { formatPaise, toPaise } from '@/lib/money';
import { OfflinePos } from '@/components/admin/offline-pos';

export const dynamic = 'force-dynamic';

export default async function OfflineSalesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePermission('orders.read');
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  const [year, month, day] = today.split('-').map(Number);
  const startDay = new Date(Date.UTC(year, month - 1, day, -5, -30));
  const startMonth = new Date(Date.UTC(year, month - 1, 1, -5, -30));
  const [dayStats, monthStats, recent, totalSales] = await Promise.all([
    prisma.offlineSale.aggregate({ where: { createdAt: { gte: startDay } }, _sum: { grandTotal: true }, _count: true }),
    prisma.offlineSale.aggregate({ where: { createdAt: { gte: startMonth } }, _sum: { grandTotal: true }, _count: true }),
    prisma.offlineSale.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * 25, take: 25, include: { items: true } }),
    prisma.offlineSale.count(),
  ]);
  return <div className="space-y-7">
    <header><h1 className="font-serif text-2xl">Offline billing</h1><p className="mt-1 text-sm text-muted">Store sales share the same stock as online orders.</p></header>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-line bg-white p-5"><p className="text-xs uppercase text-muted">Offline today · {today}</p><strong className="mt-2 block font-serif text-2xl">{formatPaise(toPaise(dayStats._sum.grandTotal ?? 0))}</strong><p className="text-sm text-muted">{dayStats._count} sales</p></div>
      <div className="rounded-lg border border-line bg-white p-5"><p className="text-xs uppercase text-muted">Offline this month</p><strong className="mt-2 block font-serif text-2xl">{formatPaise(toPaise(monthStats._sum.grandTotal ?? 0))}</strong><p className="text-sm text-muted">{monthStats._count} sales</p></div>
    </div>
    <details className="rounded-lg border border-line bg-white p-4 text-sm"><summary className="cursor-pointer font-semibold">Printer and scanner setup</summary><p className="mt-3 text-muted">Install the label and 80 mm receipt printers on this computer using their manufacturer drivers. Select the printer in the browser print dialog. Labels use 50 × 30 mm paper; receipts use 80 mm roll paper. Print at 100% scale with browser headers and margins off. Set your scanner to keyboard mode with an Enter suffix, then test one label and one receipt.</p></details>
    <OfflinePos />
    <section className="rounded-lg border border-line bg-white p-5"><h2 className="font-serif text-xl">Offline sales history</h2>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[580px] text-sm"><thead><tr className="border-b border-line text-left text-muted"><th className="py-2">Receipt</th><th>Date</th><th>Items</th><th>Payment</th><th className="text-right">Total</th></tr></thead><tbody>
        {recent.map((sale) => <tr key={sale.id} className="border-b border-line"><td className="py-3"><Link className="underline" href={`/admin/offline-sales/${sale.id}/receipt`}>{sale.receiptNumber}</Link></td><td>{sale.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td><td>{sale.items.reduce((n, item) => n + item.quantity, 0)}</td><td>{sale.paymentMethod}</td><td className="text-right">{formatPaise(toPaise(sale.grandTotal))}</td></tr>)}
      </tbody></table>{!recent.length && <p className="py-5 text-sm text-muted">No offline sales yet.</p>}</div>
      <div className="mt-4 flex justify-between text-sm"><span>{totalSales} total sales</span><div className="flex gap-4">{page > 1 && <Link href={`/admin/offline-sales?page=${page - 1}`} className="underline">Previous</Link>}{page * 25 < totalSales && <Link href={`/admin/offline-sales?page=${page + 1}`} className="underline">Next</Link>}</div></div>
    </section>
  </div>;
}
