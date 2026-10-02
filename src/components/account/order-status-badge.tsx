import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/types';

/** Human labels + tone for each order state. */
const STATUS: Record<OrderStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pending payment', className: 'bg-gold/10 text-gold-ink' },
  CONFIRMED: { label: 'Confirmed', className: 'bg-success/10 text-success' },
  PROCESSING: { label: 'Processing', className: 'bg-ink/[0.06] text-ink' },
  SHIPPED: { label: 'Shipped', className: 'bg-ink/[0.06] text-ink' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', className: 'bg-gold/10 text-gold-ink' },
  DELIVERED: { label: 'Delivered', className: 'bg-success/10 text-success' },
  CANCELLED: { label: 'Cancelled', className: 'bg-danger/10 text-danger' },
  RETURN_REQUESTED: { label: 'Return requested', className: 'bg-gold/10 text-gold-ink' },
  RETURNED: { label: 'Returned', className: 'bg-ink/[0.06] text-muted' },
  REFUNDED: { label: 'Refunded', className: 'bg-ink/[0.06] text-muted' },
};

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const config = STATUS[status];
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide2',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
