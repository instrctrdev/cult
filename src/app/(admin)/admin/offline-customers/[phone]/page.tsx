import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { formatPaise, toPaise } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function OfflineCustomerPage({ params }: { params: Promise<{ phone: string }> }) {
  await requirePermission('customers.read');
  const phone = (await params).phone.replace(/\D/g, '');
  const sales = await prisma.offlineSale.findMany({ where: { customerPhone: phone }, orderBy: { createdAt: 'desc' }, include: { items: true } });
  if (!sales.length) notFound();
  const name = sales.find((sale) => sale.customerName)?.customerName || 'Walk-in customer';
  const spend = sales.reduce((sum, sale) => sum + toPaise(sale.grandTotal), 0);
  return <div className="space-y-6">
    <Link href="/admin/offline-customers" className="text-sm text-muted underline">← Offline customers</Link>
    <header><h1 className="font-serif text-2xl">{name}</h1><p className="mt-1 text-sm text-muted">{phone} · {sales.length} orders · {formatPaise(spend)} lifetime spend</p></header>
    <section className="space-y-3">{sales.map((sale) => <Link key={sale.id} href={`/admin/offline-sales/${sale.id}`} className="block rounded-lg border border-line bg-white p-4 hover:bg-surface/40">
      <span className="flex flex-wrap justify-between gap-3"><span><strong className="underline">{sale.receiptNumber}</strong><span className="mt-1 block text-xs text-muted">{sale.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} · {sale.paymentMethod}</span></span><strong>{formatPaise(toPaise(sale.grandTotal))}</strong></span>
      <span className="mt-3 block text-sm text-muted">{sale.items.map((item) => `${item.productName}${item.variantLabel ? ` (${item.variantLabel})` : ''} × ${item.quantity}`).join(', ')}</span>
    </Link>)}</section>
  </div>;
}
