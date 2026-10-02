import 'server-only';
import { OrderStatus, ShipmentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notFound } from '@/lib/errors';
import { shippingProvider } from './shipping';

export type { ShippingProvider } from './shipping';

/**
 * Shipment management.
 *
 * Fulfilment is handled outside this system: staff record the courier, tracking
 * number and expected delivery date in the admin panel, and move the order
 * through its statuses. No carrier API is called.
 *
 * The provider seam in `./shipping` is deliberately preserved so a carrier
 * integration can later populate exactly the same Shipment rows — the order
 * model, admin screens and customer tracking view would not change.
 */

export interface ManualShipmentInput {
  courierName?: string | null;
  /** AWB / consignment / tracking number from the courier. */
  awbCode?: string | null;
  trackingUrl?: string | null;
  expectedDelivery?: Date | null;
  status?: ShipmentStatus;
  notes?: string | null;
}

/** Shipment status → the order status it implies for the customer. */
function orderStatusFor(status: ShipmentStatus): OrderStatus | null {
  switch (status) {
    case ShipmentStatus.AWB_ASSIGNED:
    case ShipmentStatus.PICKUP_SCHEDULED:
    case ShipmentStatus.IN_TRANSIT:
      return OrderStatus.SHIPPED;
    case ShipmentStatus.OUT_FOR_DELIVERY:
      return OrderStatus.OUT_FOR_DELIVERY;
    case ShipmentStatus.DELIVERED:
      return OrderStatus.DELIVERED;
    case ShipmentStatus.RTO:
      return OrderStatus.RETURNED;
    default:
      return null;
  }
}

/** Terminal order states a courier update must never move forward. */
const TERMINAL: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.REFUNDED, OrderStatus.RETURNED];

export const ShippingService = {
  /** True once an automated carrier integration is configured. */
  isAutomated(): boolean {
    return shippingProvider().isAutomated();
  },

  providerName(): string {
    return shippingProvider().name;
  },

  async getForOrder(orderId: string) {
    return prisma.shipment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Creates or updates the manual shipment record for an order.
   *
   * One shipment per order: re-saving edits the existing row rather than
   * stacking duplicates, and every change is mirrored onto the order's status
   * and timeline so the customer sees it.
   */
  async saveManualShipment(
    orderId: string,
    input: ManualShipmentInput,
    actorId: string,
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });
    if (!order) throw notFound('Order not found.');

    const existing = await prisma.shipment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });

    const status = input.status ?? existing?.status ?? ShipmentStatus.PENDING;

    const data = {
      provider: shippingProvider().name,
      status,
      courierName: input.courierName?.trim() || null,
      awbCode: input.awbCode?.trim() || null,
      trackingUrl: input.trackingUrl?.trim() || null,
      expectedDelivery: input.expectedDelivery ?? null,
      errorMessage: input.notes?.slice(0, 500) ?? null,
      // Timestamps are stamped the first time each milestone is recorded.
      shippedAt:
        existing?.shippedAt ??
        (status !== ShipmentStatus.PENDING && status !== ShipmentStatus.CANCELLED ? new Date() : null),
      deliveredAt:
        status === ShipmentStatus.DELIVERED ? existing?.deliveredAt ?? new Date() : existing?.deliveredAt ?? null,
      lastSyncedAt: new Date(),
    };

    const shipment = existing
      ? await prisma.shipment.update({ where: { id: existing.id }, data })
      : await prisma.shipment.create({ data: { ...data, orderId } });

    await prisma.orderEvent.create({
      data: {
        orderId,
        status: `SHIPMENT_${status}`,
        message: buildEventMessage(shipment.courierName, shipment.awbCode, status),
        source: 'admin',
        actorId,
      },
    });

    await this.reflectOnOrder(orderId, status, actorId);
    return shipment;
  },

  /**
   * Advances the order status to match the shipment.
   *
   * Never moves a cancelled, returned or refunded order forward, and never
   * repeats a transition that has already been applied.
   */
  async reflectOnOrder(orderId: string, status: ShipmentStatus, actorId?: string): Promise<void> {
    const next = orderStatusFor(status);
    if (!next) return;

    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (!order || TERMINAL.includes(order.status) || order.status === next) return;

    await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: { status: next, deliveredAt: next === OrderStatus.DELIVERED ? new Date() : undefined },
      }),
      prisma.orderEvent.create({
        data: {
          orderId,
          status: next,
          message: `Order marked ${next.replace(/_/g, ' ').toLowerCase()}.`,
          source: 'admin',
          actorId,
        },
      }),
    ]);
  },

  /** Marks a shipment cancelled. Kept separate from cancelling the order itself. */
  async cancelShipment(shipmentId: string, actorId?: string): Promise<void> {
    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) return;

    // A future carrier integration cancels remotely here first.
    if (this.isAutomated() && shipment.providerOrderId) {
      await shippingProvider()
        .cancel(shipment.providerOrderId)
        .catch((err) => console.error('[shipping] provider cancel failed', err));
    }

    await prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: ShipmentStatus.CANCELLED },
    });
    await prisma.orderEvent.create({
      data: {
        orderId: shipment.orderId,
        status: 'SHIPMENT_CANCELLED',
        message: 'Shipment cancelled.',
        source: 'admin',
        actorId,
      },
    });
  },

  /** Shipments needing a tracking number — the admin's fulfilment queue. */
  async awaitingDispatch(limit = 20) {
    return prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.CONFIRMED, OrderStatus.PROCESSING] },
        shipments: { none: { awbCode: { not: null } } },
      },
      orderBy: { placedAt: 'asc' },
      take: limit,
      select: {
        id: true, orderNumber: true, placedAt: true, status: true,
        grandTotal: true, paymentMethod: true, addressSnapshot: true,
        _count: { select: { items: true } },
      },
    });
  },
};

function buildEventMessage(courier: string | null, awb: string | null, status: ShipmentStatus): string {
  if (awb && courier) return `${courier} · tracking ${awb} · ${humanise(status)}`;
  if (awb) return `Tracking ${awb} · ${humanise(status)}`;
  return `Shipment ${humanise(status)}`;
}

function humanise(status: ShipmentStatus): string {
  return status.replace(/_/g, ' ').toLowerCase();
}

/** Statuses staff can pick in the admin, in fulfilment order. */
export const MANUAL_SHIPMENT_STATUSES: { value: ShipmentStatus; label: string }[] = [
  { value: ShipmentStatus.PENDING, label: 'Not dispatched' },
  { value: ShipmentStatus.AWB_ASSIGNED, label: 'Tracking assigned' },
  { value: ShipmentStatus.PICKUP_SCHEDULED, label: 'Pickup scheduled' },
  { value: ShipmentStatus.IN_TRANSIT, label: 'In transit' },
  { value: ShipmentStatus.OUT_FOR_DELIVERY, label: 'Out for delivery' },
  { value: ShipmentStatus.DELIVERED, label: 'Delivered' },
  { value: ShipmentStatus.RTO, label: 'Returned to origin' },
  { value: ShipmentStatus.FAILED, label: 'Delivery failed' },
  { value: ShipmentStatus.CANCELLED, label: 'Cancelled' },
];
