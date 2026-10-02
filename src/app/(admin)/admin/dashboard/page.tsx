import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, IndianRupee,
  Package, ShoppingCart, Users,
} from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { DashboardService } from '@/services/dashboard.service';
import { InventoryService } from '@/services/inventory.service';
import { formatPaise } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import { OrderStatusBadge } from '@/components/account/order-status-badge';
import { SalesChart } from '@/components/admin/sales-chart';
import { BehaviourFunnel } from '@/components/admin/behaviour-funnel';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  await requirePermission('orders.read');

  const [overview, series, recent, top, attention, lowStock, funnel, viewed] = await Promise.all([
    DashboardService.overview(),
    DashboardService.salesSeries(30),
    DashboardService.recentOrders(8),
    DashboardService.topProducts(5),
    DashboardService.needsAttention(5),
    InventoryService.lowStock(5),
    DashboardService.behaviourFunnel(7),
    DashboardService.viewedVsStock(7, 6),
  ]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Live figures from your store.</p>
        </div>
        <p className="figure text-2xs uppercase tracking-wide2 text-faint">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </header>

      {/* ── Stat tiles ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          href="/admin/orders"
          label="Revenue this month"
          value={formatPaise(overview.revenue.monthPaise)}
          sub={
            overview.revenue.monthChangePercent === null
              ? 'No prior month to compare'
              : `${overview.revenue.monthChangePercent >= 0 ? '+' : ''}${overview.revenue.monthChangePercent}% vs last month`
          }
          trend={overview.revenue.monthChangePercent}
          Icon={IndianRupee}
        />
        <Stat
          href="/admin/orders"
          label="Orders this month"
          value={String(overview.orders.month)}
          sub={`${overview.orders.todayPlaced} placed today`}
          Icon={ShoppingCart}
        />
        <Stat
          href="/admin/customers"
          label="Customers"
          value={String(overview.customers)}
          sub={`${overview.orders.pending} order${overview.orders.pending === 1 ? '' : 's'} awaiting action`}
          Icon={Users}
        />
        <Stat
          href="/admin/inventory"
          label="Active products"
          value={String(overview.products)}
          sub={`${overview.lowStock} low on stock`}
          tone={overview.lowStock > 0 ? 'warn' : undefined}
          Icon={Package}
        />
      </div>

      {/* ── Attention ────────────────────────────────────────────────── */}
      {(overview.lowStock > 0 || attention.length > 0 || overview.pendingReviews > 0) && (
        <section className="rounded-lg border border-gold/30 bg-gold/[0.04] px-5 py-4">
          <h2 className="mb-2 flex items-center gap-2 font-serif text-base">
            <AlertTriangle className="h-4 w-4 shrink-0 text-gold-ink" aria-hidden />
            Needs your attention
          </h2>
          <ul className="space-y-1.5 text-sm">
            {lowStock.length > 0 && (
              <li>
                <Link href="/admin/inventory" className="text-ink underline-offset-4 hover:underline">
                  {overview.lowStock} variant{overview.lowStock === 1 ? '' : 's'} at or below the low-stock threshold
                </Link>
              </li>
            )}
            {attention.length > 0 && (
              <li>
                <Link href="/admin/products?needsAttention=1" className="text-ink underline-offset-4 hover:underline">
                  {attention.length} imported product{attention.length === 1 ? '' : 's'} still need a description or real imagery
                </Link>
              </li>
            )}
            {overview.pendingReviews > 0 && (
              <li>
                <Link href="/admin/reviews" className="text-ink underline-offset-4 hover:underline">
                  {overview.pendingReviews} review{overview.pendingReviews === 1 ? '' : 's'} awaiting approval
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}

      {/* ── Sales chart ──────────────────────────────────────────────── */}
      <section className="rounded-lg border border-line p-5">
        <h2 className="mb-1 font-serif text-lg">Sales overview</h2>
        <p className="mb-5 text-xs text-muted">Last 30 days · confirmed orders only</p>
        <SalesChart data={series} />
      </section>

      {/* ── Where shoppers stop ──────────────────────────────────────── */}
      <BehaviourFunnel funnel={funnel} viewed={viewed} />

      <div className="grid gap-5 xl:grid-cols-2">
        {/* ── Recent orders ──────────────────────────────────────────── */}
        <section className="rounded-lg border border-line">
          <div className="flex items-center justify-between border-b border-line p-5">
            <h2 className="font-serif text-lg">Recent orders</h2>
            <Link href="/admin/orders" className="text-2xs uppercase tracking-wide2 text-muted hover:text-ink hover:underline">
              View all →
            </Link>
          </div>

          {recent.length === 0 ? (
            <p className="p-5 text-sm text-muted">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((order) => {
                const snapshot = order.addressSnapshot as { fullName?: string } | null;
                return (
                  <li key={order.id}>
                    <Link href={`/admin/orders/${order.id}`} className="flex items-center gap-3 p-4 transition-colors hover:bg-surface">
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="font-sans text-sm font-medium">{order.orderNumber}</span>
                          <OrderStatusBadge status={order.status} />
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {snapshot?.fullName ?? order.email} · {order._count.items} item
                          {order._count.items === 1 ? '' : 's'} · {formatDate(order.placedAt)}
                        </span>
                      </span>
                      <span className="figure text-sm">{formatPaise(Number(order.grandTotal) * 100)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Top products ───────────────────────────────────────────── */}
        <section className="rounded-lg border border-line">
          <h2 className="border-b border-line p-5 font-serif text-lg">Best selling</h2>
          {top.length === 0 ? (
            <p className="p-5 text-sm text-muted">No sales recorded yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {top.map((product) => (
                <li key={product.id} className="flex items-center gap-3 p-4">
                  <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded bg-surface">
                    {product.imageUrl && <Image src={product.imageUrl} alt="" fill sizes="44px" className="object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link href={`/admin/products/${product.id}`} className="line-clamp-2-safe text-sm text-ink hover:underline">
                      {product.name}
                    </Link>
                    <span className="figure mt-0.5 block text-xs text-muted">{product.unitsSold} sold</span>
                  </span>
                  <span className="figure text-sm">{formatPaise(product.revenuePaise)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({
  label, value, sub, trend, tone, href, Icon,
}: {
  label: string;
  value: string;
  sub: string;
  trend?: number | null;
  /** Draws the caption as a warning — used where the number is a to-do, not a win. */
  tone?: 'warn';
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-line p-5 transition-colors hover:border-ink/25 hover:bg-surface/60"
    >
      <div className="flex items-start justify-between">
        <p className="text-2xs uppercase tracking-wide2 text-muted">{label}</p>
        <Icon className="h-4 w-4 text-faint transition-colors group-hover:text-muted" />
      </div>
      <p className="figure mt-3 font-serif text-[28px] leading-none">{value}</p>
      <p
        className={cn(
          'figure mt-2 flex items-center gap-1 text-xs',
          tone === 'warn' ? 'text-gold-ink' : trend == null ? 'text-muted' : trend >= 0 ? 'text-success' : 'text-danger',
        )}
      >
        {trend != null &&
          (trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />)}
        {sub}
      </p>
    </Link>
  );
}
