import Link from 'next/link';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { formatPaise, toPaise } from '@/lib/money';
import { AdminFilterBar } from '@/components/admin/admin-filter-bar';

export const dynamic = 'force-dynamic';

export default async function OfflineCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requirePermission('customers.read');
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const search = sp.q?.trim();
  const where = {
    customerPhone: { not: null as null },
    ...(search ? { OR: [{ customerPhone: { contains: search } }, { customerName: { contains: search } }] } : {}),
  };
  const [groups, allPhones] = await Promise.all([
    prisma.offlineSale.groupBy({
      by: ['customerPhone'], where, _count: { _all: true }, _sum: { grandTotal: true }, _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } }, skip: (page - 1) * 25, take: 25,
    }),
    prisma.offlineSale.findMany({ where, distinct: ['customerPhone'], select: { customerPhone: true } }),
  ]);
  const phones = groups.flatMap((group) => group.customerPhone ? [group.customerPhone] : []);
  const recent = await prisma.offlineSale.findMany({ where: { customerPhone: { in: phones } }, orderBy: { createdAt: 'desc' }, select: { customerPhone: true, customerName: true } });
  const nameByPhone = new Map<string, string>();
  for (const sale of recent) if (sale.customerPhone && sale.customerName && !nameByPhone.has(sale.customerPhone)) nameByPhone.set(sale.customerPhone, sale.customerName);
  const totalPages = Math.ceil(allPhones.length / 25);

  return <div className="space-y-6">
    <header><h1 className="font-serif text-2xl">Offline customers</h1><p className="mt-1 text-sm text-muted">{allPhones.length} customers identified by mandatory phone number</p></header>
    <AdminFilterBar basePath="/admin/offline-customers" searchPlaceholder="Name or phone" filters={[]} />
    <div className="overflow-x-auto rounded-lg border border-line bg-white"><table className="w-full min-w-[650px] text-sm">
      <thead className="border-b border-line bg-surface/50 text-left"><tr><th className="p-3">Customer</th><th>Phone</th><th>Orders</th><th>Last purchase</th><th className="p-3 text-right">Lifetime spend</th></tr></thead>
      <tbody className="divide-y divide-line">{groups.map((group) => group.customerPhone && <tr key={group.customerPhone} className="hover:bg-surface/40">
        <td className="p-3"><Link className="font-medium underline" href={`/admin/offline-customers/${group.customerPhone}`}>{nameByPhone.get(group.customerPhone) || 'Walk-in customer'}</Link></td>
        <td>{group.customerPhone}</td><td>{group._count._all}</td><td>{group._max.createdAt?.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
        <td className="p-3 text-right">{formatPaise(toPaise(group._sum.grandTotal ?? 0))}</td>
      </tr>)}</tbody>
    </table>{!groups.length && <p className="p-8 text-center text-sm text-muted">No offline customers found.</p>}</div>
    {totalPages > 1 && <nav className="flex justify-center gap-4 text-sm">{page > 1 && <Link className="underline" href={`/admin/offline-customers?page=${page - 1}`}>Previous</Link>}{page < totalPages && <Link className="underline" href={`/admin/offline-customers?page=${page + 1}`}>Next</Link>}</nav>}
  </div>;
}
