import 'server-only';
import { CustomerEventType, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { publicEnv } from '@/lib/env';
import { toPaise } from '@/lib/money';
import { CustomerEventService } from './customer-event.service';
import { MetaCapiService } from './meta-capi.service';

const PURCHASE_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

/** Reports a Purchase only after the database says the order is real. */
export const PurchaseTrackingService = {
  async reportConfirmedOrder(orderId: string): Promise<void> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: { select: { productId: true, quantity: true } },
          payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } },
        },
      });
      if (!order || !PURCHASE_STATUSES.includes(order.status)) return;

      const payment = order.payments[0];
      if (order.paymentMethod === PaymentMethod.PREPAID && payment?.status !== PaymentStatus.PAID) return;

      const address = order.addressSnapshot as {
        phone?: string;
        city?: string;
        state?: string;
        pincode?: string;
      } | null;
      const productIds = [...new Set(order.items.map((item) => item.productId).filter((id): id is string => Boolean(id)))];
      const quantities = new Map<string, number>();
      for (const item of order.items) {
        if (item.productId) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
      }

      await CustomerEventService.record({
        eventType: CustomerEventType.PURCHASE,
        userId: order.userId,
        cartId: order.sourceCartId,
        metadata: { orderNumber: order.orderNumber },
      });
      await CustomerEventService.cancelPendingFor(order.userId, productIds);

      await MetaCapiService.sendPurchase({
        eventId: order.orderNumber,
        valuePaise: toPaise(order.grandTotal),
        contentIds: productIds,
        contents: [...quantities].map(([id, quantity]) => ({ id, quantity })),
        numItems: order.items.reduce((total, item) => total + item.quantity, 0),
        email: order.email,
        phone: order.phone || address?.phone,
        city: address?.city,
        state: address?.state,
        pincode: address?.pincode,
        occurredAt: order.confirmedAt ?? order.placedAt,
        eventSourceUrl: `${publicEnv.NEXT_PUBLIC_SITE_URL}/checkout/confirmation/${order.orderNumber}`,
      });
    } catch (err) {
      // Conversion reporting must never roll back or reject a valid order.
      console.error('[purchase-tracking] confirmed order reporting failed', { orderId }, err);
    }
  },
};
