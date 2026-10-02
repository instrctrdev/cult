import type { Metadata } from 'next';
import Link from 'next/link';
import { OrderStatus, PaymentMethod, Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { formatPaise } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import { OrderStatusBadge } from '@/components/account/order-status-badge';
import { AdminFilterBar } from '@/components/admin/admin-filter-bar';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Orders' };

const PER_PAGE = 25;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; unfulfilled?: string }>;
}) {
  await requirePermission('orders.read');
  const sp = await searchParams;

  const page = Math.max(1, Number(sp.page) || 1);
  const status = sp.status && sp.status in OrderStatus ? (sp.status as OrderStatus) : undefined;

  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
    ...(sp.unfulfilled === '1'
      ? {
          status: { in: [OrderStatus.CONFIRMED, OrderStatus.PROCESSING] },
          shipments: { none: { awbCode: { not: null } } },
        }
      : {}),
    ...(sp.q
      ? {
          OR: [
            { orderNumber: { contains: sp.q } },
            { email: { contains: sp.q } },
            { phone: { contains: sp.q } },
          ],
        }
      : {}),
  };

  const [total, orders, statusCounts] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { placedAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true, orderNumber: true, status: true, grandTotal: true, placedAt: true,
        email: true, paymentMethod: true, addressSnapshot: true,
        _count: { select: { items: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } },
        shipments: { orderBy: { createdAt: 'desc' }, take: 1, select: { awbCode: true, courierName: true } },
      },
    }),
    prisma.order.groupBy({ by: ['status'], _count: { status: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const countFor = (s: OrderStatus) => statusCounts.find((c) => c.status === s)?._count.status ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl">Orders</h1>
          <p className="mt-1 text-sm text-muted">{total} order{total === 1 ? '' : 's'}</p>
        </div>
      </header>

      <AdminFilterBar
        basePath="/admin/orders"
        searchPlaceholder="Order number, email or phone"
        filters={[
          { label: 'All', param: {} },
          { label: 'Awaiting dispatch', param: { unfulfilled: '1' } },
          ...(Object.values(OrderStatus) as OrderStatus[])
            .filter((s) => countFor(s) > 0)
            .map((s) => ({
              label: `${s.replace(/_/g, ' ').toLowerCase()} (${countFor(s)})`,
              param: { status: s },
            })),
        ]}
      />

      {orders.length === 0 ? (
        <p className="rounded-lg border border-line p-10 text-center text-sm text-muted">
          No orders match this view.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-line bg-surface/50 text-left">
              <tr className="text-2xs uppercase tracking-wide2 text-muted">
                <th className="p-3 font-medium">Order</th>
                <th className="p-3 font-medium">Customer</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Payment</th>
                <th className="p-3 font-medium">Tracking</th>
                <th className="p-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((order) => {
                const snapshot = order.addressSnapshot as { fullName?: string } | null;
                const shipment = order.shipments[0];
                return (
                  <tr key={order.id} className="transition-colors hover:bg-surface/40">
                    <td className="p-3">
                      <Link href={`/admin/orders/${order.id}`} className="font-medium text-ink hover:underline">
                        {order.orderNumber}
                      </Link>
                      <span className="mt-0.5 block text-2xs text-faint">
                        {formatDate(order.placedAt)} · {order._count.items} item{order._count.items === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="block text-ink">{snapshot?.fullName ?? '—'}</span>
                      <span className="block truncate text-2xs text-faint">{order.email}</span>
                    </td>
                    <td className="p-3"><OrderStatusBadge status={order.status} /></td>
                    <td className="p-3">
                      <span className="block text-xs text-ink">
                        {order.paymentMethod === PaymentMethod.COD ? 'COD' : 'Prepaid'}
                      </span>
                      <span className="block text-2xs text-faint">
                        {order.payments[0]?.status.toLowerCase() ?? '—'}
                      </span>
                    </td>
                    <td className="p-3">
                      {shipment?.awbCode ? (
                        <>
                          <span className="block text-xs text-ink">{shipment.awbCode}</span>
                          <span className="block text-2xs text-faint">{shipment.courierName ?? '—'}</span>
                        </>
                      ) : (
                        <span className="text-2xs uppercase tracking-wide2 text-gold-ink">Not dispatched</span>
                      )}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {formatPaise(Number(order.grandTotal) * 100)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex justify-center gap-2">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((n) => {
            const params = new URLSearchParams(sp as Record<string, string>);
            params.set('page', String(n));
            return (
              <Link
                key={n}
                href={`/admin/orders?${params.toString()}`}
                aria-current={n === page ? 'page' : undefined}
                className={`grid h-9 w-9 place-items-center rounded-md text-sm ${
                  n === page ? 'bg-ink text-bg' : 'border border-line text-muted hover:border-ink hover:text-ink'
                }`}
              >
                {n}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
