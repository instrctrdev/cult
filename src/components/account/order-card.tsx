import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatPaise } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import { OrderStatusBadge } from './order-status-badge';
import type { OrderDTO } from '@/types';

export function OrderCard({ order }: { order: OrderDTO }) {
  const preview = order.items.slice(0, 3);
  const extra = order.items.length - preview.length;

  return (
    <Link
      href={`/account/orders/${order.id}`}
      className="block rounded-lg border border-line p-4 transition-colors hover:border-ink/25 hover:bg-surface/60"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="font-sans text-sm font-medium tracking-wide">{order.orderNumber}</span>
          <OrderStatusBadge status={order.status} />
        </div>
        <span className="text-xs text-muted">{formatDate(order.placedAt, 'long')}</span>
      </div>

      <div className="mt-3.5 flex items-center gap-3">
        <div className="flex -space-x-2">
          {preview.map((item) => (
            <span key={item.id} className="relative h-14 w-11 overflow-hidden rounded border-2 border-bg bg-surface">
              {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="44px" className="object-cover" />}
            </span>
          ))}
          {extra > 0 && (
            <span className="grid h-14 w-11 place-items-center rounded border-2 border-bg bg-surface text-xs text-muted">
              +{extra}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink">
            {order.items.length} item{order.items.length === 1 ? '' : 's'} · {formatPaise(order.totalPaise)}
          </p>
          {order.shipment?.awbCode && (
            <p className="mt-0.5 truncate text-xs text-muted">
              {order.shipment.courierName ?? 'Courier'} · AWB {order.shipment.awbCode}
            </p>
          )}
        </div>

        <ChevronRight className="h-4 w-4 shrink-0 text-faint" aria-hidden />
      </div>
    </Link>
  );
}
