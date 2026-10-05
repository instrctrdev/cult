import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { formatPaise, toPaise } from '@/lib/money';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function OnlineCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('customers.read');
  const { id } = await params;
  const customer = await prisma.user.findFirst({
    where: { id, role: 'CUSTOMER', deletedAt: null },
    include: { orders: { orderBy: { placedAt: 'desc' }, include: { items: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } } } },
  });
  if (!customer) notFound();
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Customer';
  const completed = customer.orders.filter((order) => !['PENDING', 'CANCELLED', 'RETURNED', 'REFUNDED'].includes(order.status));
  const spend = completed.reduce((sum, order) => sum + toPaise(order.grandTotal), 0);

  return <div className="space-y-6">
    <Link href="/admin/customers" className="text-sm text-muted underline">← Online customers</Link>
    <header><h1 className="font-serif text-2xl">{name}</h1><p className="mt-1 text-sm text-muted">{customer.email}{customer.phone ? ` · ${customer.phone}` : ''}</p></header>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border border-line bg-white p-4"><span className="text-xs text-muted">Joined</span><strong className="mt-1 block">{formatDate(customer.createdAt)}</strong></div>
      <div className="rounded-lg border border-line bg-white p-4"><span className="text-xs text-muted">Orders</span><strong className="mt-1 block">{customer.orders.length}</strong></div>
      <div className="rounded-lg border border-line bg-white p-4"><span className="text-xs text-muted">Lifetime spend</span><strong className="mt-1 block">{formatPaise(spend)}</strong></div>
    </div>
    <section><h2 className="mb-3 font-serif text-xl">Past orders</h2><div className="space-y-3">
      {customer.orders.map((order) => <div key={order.id} className="rounded-lg border border-line bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><Link href={`/admin/orders/${order.id}`} className="font-semibold underline">{order.orderNumber}</Link><p className="mt-1 text-xs text-muted">{order.placedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} · {order.paymentMethod} · {order.payments[0]?.status ?? 'No payment record'}</p></div><div className="text-right"><strong>{formatPaise(toPaise(order.grandTotal))}</strong><span className="block text-xs text-muted">{order.status.replaceAll('_', ' ')}</span></div></div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">{order.items.map((item) => <li key={item.id} className="flex gap-3 text-sm"><span className="relative h-14 w-11 shrink-0 overflow-hidden rounded bg-surface">{item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="44px" className="object-cover" />}</span><span><span className="block">{item.productName}</span><span className="text-xs text-muted">{item.variantLabel || item.sku} · {item.quantity} × {formatPaise(toPaise(item.unitPrice))}</span></span></li>)}</ul>
      </div>)}
      {!customer.orders.length && <p className="rounded-lg border border-line p-8 text-center text-sm text-muted">No orders yet.</p>}
    </div></section>
  </div>;
}
