import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePermission } from '@/lib/auth/session';
import { CustomerService } from '@/services/customer.service';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/utils';
import { formatPaise } from '@/lib/money';
import { AdminFilterBar } from '@/components/admin/admin-filter-bar';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Customers' };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requirePermission('customers.read');
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const result = await CustomerService.listCustomers({ page, perPage: 25, search: sp.q });

  // Lifetime value, computed only for the rows on screen.
  const spend = await prisma.order.groupBy({
    by: ['userId'],
    where: {
      userId: { in: result.data.map((c) => c.id) },
      status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'] },
    },
    _sum: { grandTotal: true },
  });
  const spendByUser = new Map(spend.map((s) => [s.userId, Number(s._sum.grandTotal ?? 0)]));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl">Customers</h1>
        <p className="mt-1 text-sm text-muted">{result.total} registered customer{result.total === 1 ? '' : 's'}</p>
      </header>

      <AdminFilterBar basePath="/admin/customers" searchPlaceholder="Name, email or phone" filters={[]} />

      {result.data.length === 0 ? (
        <p className="rounded-lg border border-line p-10 text-center text-sm text-muted">No customers found.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-line bg-surface/50 text-left">
              <tr className="text-2xs uppercase tracking-wide2 text-muted">
                <th className="p-3 font-medium">Customer</th>
                <th className="p-3 font-medium">Phone</th>
                <th className="p-3 font-medium">Joined</th>
                <th className="p-3 font-medium">Orders</th>
                <th className="p-3 text-right font-medium">Lifetime spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {result.data.map((customer) => (
                <tr key={customer.id} className="transition-colors hover:bg-surface/40">
                  <td className="p-3">
                    <span className="block text-ink">
                      {[customer.firstName, customer.lastName].filter(Boolean).join(' ') || '—'}
                    </span>
                    <span className="block break-all text-2xs text-faint">{customer.email}</span>
                  </td>
                  <td className="p-3 text-muted">{customer.phone ?? '—'}</td>
                  <td className="p-3 text-muted">{formatDate(customer.createdAt)}</td>
                  <td className="p-3 tabular-nums">{customer._count.orders}</td>
                  <td className="p-3 text-right tabular-nums">
                    {formatPaise((spendByUser.get(customer.id) ?? 0) * 100)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.totalPages > 1 && (
        <nav aria-label="Pagination" className="flex justify-center gap-2">
          {Array.from({ length: Math.min(result.totalPages, 10) }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={`/admin/customers?page=${n}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ''}`}
              aria-current={n === page ? 'page' : undefined}
              className={`grid h-9 w-9 place-items-center rounded-md text-sm ${
                n === page ? 'bg-ink text-bg' : 'border border-line text-muted hover:border-ink hover:text-ink'
              }`}
            >
              {n}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
