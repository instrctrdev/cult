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
    <details className="rounded-lg border border-line bg-white p-4 text-sm"><summary className="cursor-pointer font-semibold">Windows printer and scanner setup</summary><div className="mt-3 grid gap-3 text-muted sm:grid-cols-2"><p><strong className="text-ink">Labels · Shreyans P58D Bluetooth</strong><br />Pair it in Windows Settings → Bluetooth &amp; devices → Printers &amp; scanners → Add device. Install its Windows driver, choose the Bluetooth COM port if requested, and set custom paper to 50 × 30 mm.</p><p><strong className="text-ink">Bills · TVS RP 3230 USB</strong><br />Install the TVS Windows receipt driver and select the paper width actually loaded, usually 80 mm. The barcode scanner should use keyboard mode with an Enter suffix.</p></div><p className="mt-3 text-muted">In Chrome choose the required printer in the print dialog, use 100% scale and turn margins, headers and footers off. Print one Windows test page, one product label and one receipt before billing.</p><p className="mt-2 flex gap-4"><a className="underline" href="https://www.shreyanspos.com/pages/psf58d" target="_blank" rel="noopener noreferrer">Shreyans Windows driver</a><a className="underline" href="https://www.tvs-e.in/product-support/" target="_blank" rel="noopener noreferrer">TVS Windows driver</a></p></details>
    <OfflinePos />
    <section className="rounded-lg border border-line bg-white p-5"><h2 className="font-serif text-xl">Offline sales history</h2>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[580px] text-sm"><thead><tr className="border-b border-line text-left text-muted"><th className="py-2">Receipt</th><th>Date</th><th>Items</th><th>Payment</th><th className="text-right">Total</th></tr></thead><tbody>
        {recent.map((sale) => <tr key={sale.id} className="border-b border-line"><td className="py-3"><Link className="underline" href={`/admin/offline-sales/${sale.id}`}>{sale.receiptNumber}</Link></td><td>{sale.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td><td>{sale.items.reduce((n, item) => n + item.quantity, 0)}</td><td>{sale.paymentMethod}</td><td className="text-right">{formatPaise(toPaise(sale.grandTotal))}</td></tr>)}
      </tbody></table>{!recent.length && <p className="py-5 text-sm text-muted">No offline sales yet.</p>}</div>
      <div className="mt-4 flex justify-between text-sm"><span>{totalSales} total sales</span><div className="flex gap-4">{page > 1 && <Link href={`/admin/offline-sales?page=${page - 1}`} className="underline">Previous</Link>}{page * 25 < totalSales && <Link href={`/admin/offline-sales?page=${page + 1}`} className="underline">Next</Link>}</div></div>
    </section>
  </div>;
}
