import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { OrderService } from '@/services/order.service';
import { OrderDetail } from '@/components/account/order-detail';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Order details',
  robots: { index: false, follow: false },
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;

  if (!user) redirect(`/account/login?next=/account/orders/${id}`);

  // Scoped to the signed-in customer — another user's id yields a 404.
  const order = await OrderService.getById(id, user.id);
  if (!order) notFound();

  return (
    <div className="container max-w-3xl py-8 lg:py-12">
      <nav aria-label="Breadcrumb" className="mb-4">
        <Link href="/account/orders" className="text-2xs uppercase tracking-wide2 text-muted hover:text-ink hover:underline">
          ← My orders
        </Link>
      </nav>
      <OrderDetail order={order} />
    </div>
  );
}
