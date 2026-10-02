import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { OrderService } from '@/services/order.service';
import { OrderCard } from '@/components/account/order-card';
import { EmptyState } from '@/components/ui/states';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My orders',
  robots: { index: false, follow: false },
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/account/login?next=/account/orders');

  const { page } = await searchParams;
  const current = Math.max(1, Number(page) || 1);
  const orders = await OrderService.listForUser(user.id, current, 10);

  return (
    <div className="container py-8 lg:py-12">
      <nav aria-label="Breadcrumb" className="mb-4">
        <Link href="/account" className="text-2xs uppercase tracking-wide2 text-muted hover:text-ink hover:underline">
          ← My account
        </Link>
      </nav>

      <h1 className="mb-8 text-3xl">My orders</h1>

      {orders.data.length === 0 ? (
        <EmptyState
          title="No orders yet"
          message="Once you place an order it will appear here with live tracking."
          actionLabel="Start shopping"
          actionHref="/shop"
        />
      ) : (
        <>
          <ul className="space-y-3">
            {orders.data.map((order) => (
              <li key={order.id}><OrderCard order={order} /></li>
            ))}
          </ul>

          {orders.totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
              {Array.from({ length: orders.totalPages }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={`/account/orders?page=${n}`}
                  aria-current={n === current ? 'page' : undefined}
                  className={`grid h-10 w-10 place-items-center rounded-md text-sm transition-colors ${
                    n === current ? 'bg-ink text-bg' : 'border border-line text-muted hover:border-ink hover:text-ink'
                  }`}
                >
                  {n}
                </Link>
              ))}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
