import Link from 'next/link';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { formatPaise, toPaise } from '@/lib/money';
import { OfflinePos } from '@/components/admin/offline-pos';
import { offlineSaleFilters, type OfflineSaleSearch } from '@/lib/offline-sale-filters';

export const dynamic = 'force-dynamic';

export default async function OfflineSalesPage({ searchParams }: { searchParams: Promise<OfflineSaleSearch> }) {
  await requirePermission('orders.read');
  const search = await searchParams;
  const pageNumber = Number(search.page);
  const page = Number.isFinite(pageNumber) ? Math.max(1, Math.min(100000, Math.floor(pageNumber))) : 1;
  const { where, period, error } = offlineSaleFilters(search);
  const pageHref = (number: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(search)) if (value && key !== 'page') params.set(key, value);
    params.set('page', String(number));
    return `/admin/offline-sales?${params.toString()}`;
  };
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  const [year, month, day] = today.split('-').map(Number);
  const startDay = new Date(Date.UTC(year, month - 1, day, -5, -30));
  const startMonth = new Date(Date.UTC(year, month - 1, 1, -5, -30));
  const [dayStats, monthStats, recent, totalSales, filteredStats, cashiers] = await Promise.all([
    prisma.offlineSale.aggregate({ where: { createdAt: { gte: startDay } }, _sum: { grandTotal: true }, _count: true }),
    prisma.offlineSale.aggregate({ where: { createdAt: { gte: startMonth } }, _sum: { grandTotal: true }, _count: true }),
    prisma.offlineSale.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 25, take: 25, include: { items: true } }),
    prisma.offlineSale.count({ where }),
    prisma.offlineSale.aggregate({ where, _sum: { grandTotal: true } }),
    prisma.user.findMany({ where: { role: { not: 'CUSTOMER' } }, select: { id: true, firstName: true, lastName: true, email: true }, orderBy: { firstName: 'asc' } }),
  ]);
  const cashierNames = new Map(cashiers.map((cashier) => [cashier.id, [cashier.firstName, cashier.lastName].filter(Boolean).join(' ') || cashier.email]));
  return <div className="space-y-7">
    <header><h1 className="font-serif text-2xl">Offline billing</h1><p className="mt-1 text-sm text-muted">Store sales share the same stock as online orders.</p></header>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-line bg-white p-5"><p className="text-xs uppercase text-muted">Offline today · {today}</p><strong className="mt-2 block font-serif text-2xl">{formatPaise(toPaise(dayStats._sum.grandTotal ?? 0))}</strong><p className="text-sm text-muted">{dayStats._count} sales</p></div>
      <div className="rounded-lg border border-line bg-white p-5"><p className="text-xs uppercase text-muted">Offline this month</p><strong className="mt-2 block font-serif text-2xl">{formatPaise(toPaise(monthStats._sum.grandTotal ?? 0))}</strong><p className="text-sm text-muted">{monthStats._count} sales</p></div>
    </div>
    <details className="rounded-lg border border-line bg-white p-4 text-sm"><summary className="cursor-pointer font-semibold">Windows printer and scanner setup</summary><div className="mt-3 grid gap-3 text-muted sm:grid-cols-2"><p><strong className="text-ink">Labels · Shreyans P58D Bluetooth</strong><br />Pair it in Windows Settings → Bluetooth &amp; devices → Printers &amp; scanners → Add device. Install the P58D Windows Label Driver, choose the Bluetooth COM port if requested, and set custom paper to 40 × 25 mm with Portrait orientation.</p><p><strong className="text-ink">Bills · TVS RP 3230 USB</strong><br />Install the TVS Windows receipt driver and select the paper width actually loaded, usually 80 mm. The barcode scanner should use keyboard mode with an Enter suffix.</p></div><p className="mt-3 text-muted">For labels choose Portrait, 100% scale, no margins and no headers or footers. Landscape makes one page cross two stickers. Print one Windows test page, one product label and one receipt before billing.</p><p className="mt-2 flex gap-4"><a className="underline" href="https://cdn.shopify.com/s/files/1/0857/2020/3564/files/P58DLabelSetup.zip?v=1789812954" target="_blank" rel="noopener noreferrer">P58D Windows label driver</a><a className="underline" href="https://www.tvs-e.in/product-support/" target="_blank" rel="noopener noreferrer">TVS Windows driver</a></p></details>
    <OfflinePos />
    <section className="rounded-lg border border-line bg-white p-5"><h2 className="font-serif text-xl">Offline sales history</h2>
      <form action="/admin/offline-sales" className="mt-4 flex flex-wrap items-end gap-3 text-sm">
        <label>Search<input name="q" defaultValue={search.q} placeholder="Receipt, customer or phone" className="mt-1 block rounded border border-line p-2" /></label>
        <label>Period<select name="period" defaultValue={period} className="mt-1 block rounded border border-line p-2"><option value="all">All dates</option><option value="today">Today</option><option value="week">Last 7 days</option><option value="month">This month</option><option value="custom">Custom dates</option></select></label>
        <label>From<input name="from" type="date" defaultValue={search.from} className="mt-1 block rounded border border-line p-2" /></label>
        <label>To<input name="to" type="date" defaultValue={search.to} className="mt-1 block rounded border border-line p-2" /></label>
        <label>Payment<select name="payment" defaultValue={search.payment ?? ''} className="mt-1 block rounded border border-line p-2"><option value="">All payments</option><option value="CASH">Cash</option><option value="CARD">Card</option></select></label>
        <label>Cashier<select name="cashier" defaultValue={search.cashier ?? ''} className="mt-1 block rounded border border-line p-2"><option value="">All cashiers</option>{cashiers.map((cashier) => <option key={cashier.id} value={cashier.id}>{cashierNames.get(cashier.id)}</option>)}</select></label>
        <button className="rounded bg-ink px-4 py-2 text-white">Apply filters</button><Link href="/admin/offline-sales" className="px-2 py-2 underline">Reset</Link>
      </form>
      <p className="mt-2 text-xs text-muted">Choose Custom dates to use From / To. Dates use India time.</p>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <p className="mt-4 text-sm"><strong>{totalSales}</strong> matching sales · Total <strong>{formatPaise(toPaise(filteredStats._sum.grandTotal ?? 0))}</strong></p>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead><tr className="border-b border-line text-left text-muted"><th className="py-2">Receipt</th><th>Date</th><th>Customer</th><th>Cashier</th><th>Items</th><th>Payment</th><th className="text-right">Total</th></tr></thead><tbody>
        {recent.map((sale) => <tr key={sale.id} className="border-b border-line"><td className="py-3"><Link className="underline" href={`/admin/offline-sales/${sale.id}`}>{sale.receiptNumber}</Link></td><td>{sale.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td><td>{sale.customerName || 'Walk-in customer'}<span className="block text-xs text-muted">{sale.customerPhone}</span></td><td>{sale.cashierId ? cashierNames.get(sale.cashierId) || 'Former cashier' : '—'}</td><td>{sale.items.reduce((n, item) => n + item.quantity, 0)}</td><td>{sale.paymentMethod}</td><td className="text-right">{formatPaise(toPaise(sale.grandTotal))}</td></tr>)}
      </tbody></table>{!recent.length && <p className="py-5 text-sm text-muted">No offline sales yet.</p>}</div>
      <div className="mt-4 flex justify-between text-sm"><span>{totalSales} matching sales</span><div className="flex gap-4">{page > 1 && <Link href={pageHref(page - 1)} className="underline">Previous</Link>}{page * 25 < totalSales && <Link href={pageHref(page + 1)} className="underline">Next</Link>}</div></div>
    </section>
  </div>;
}
