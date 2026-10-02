import 'server-only';
import {
  InventoryReason, OrderStatus, PaymentMethod, PaymentStatus, Prisma,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError, badRequest, conflict, notFound } from '@/lib/errors';
import { toDecimal, toPaise } from '@/lib/money';
import { getSettings } from '@/lib/settings';
import { CartService } from './cart.service';
import { CouponService } from './coupon.service';
import { InventoryService } from './inventory.service';
import { PurchaseTrackingService } from './purchase-tracking.service';
import { quote } from './pricing.service';
import type { AddressSnapshot, OrderDTO, OrderItemDTO } from '@/types';

export interface CheckoutInput {
  userId: string | null;
  email: string;
  phone: string;
  /**
   * Null only when the payment gateway will collect it — Cashfree's One Click
   * Checkout. `PaymentService.captureCollectedAddress` fills the snapshot in
   * once payment settles, before the order is confirmed.
   */
  address: AddressSnapshot | null;
  /** Persist the address to the customer's address book. */
  saveAddress?: boolean;
  paymentMethod: PaymentMethod;
  couponCode?: string | null;
  customerNote?: string | null;
  /** Client-generated key; the unique index makes a double submit a no-op. */
  idempotencyKey: string;
  /**
   * "Buy now" — purchase exactly this one item and ignore the cart entirely.
   *
   * Without it, buying a single item from a product page would sweep up
   * whatever else was already in the bag, which is not what the button says.
   * The cart is left untouched, so anything already in it survives.
   */
  buyNow?: { variantId: string; quantity: number } | null;
  /**
   * Exact lines to buy, overriding both the cart and `buyNow`.
   *
   * Used when settling a CheckoutIntent: the snapshot taken when the customer
   * opened the payment sheet is what they paid for, so re-reading the cart at
   * settlement — which they may have edited since — would build the wrong
   * order.
   */
  lines?: { variantId: string; quantity: number }[] | null;
}

/** Options that change how an order is created, as opposed to what is in it. */
export interface CreateOrderOptions {
  /**
   * Skip the stock reservation.
   *
   * Only for an order being created *because* payment already settled: it is
   * confirmed in the same breath, and confirming commits the stock outright,
   * so reserving first would be a reservation released a moment later. It
   * also means a sale can proceed when stock has run out in the meantime —
   * the money is already taken, so the order must exist to be dealt with;
   * `InventoryService.commit` logs the shortfall rather than hiding it.
   */
  reserve?: boolean;
}

/** Statuses from which a customer may still cancel. */
const CANCELLABLE: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING];
/** Default request window; review CULT's final return policy before launch. */
const RETURN_WINDOW_DAYS = 3;

async function nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const settings = await getSettings();
  const prefix = settings['orders.number_prefix'] as string;
  const year = new Date().getFullYear();

  // Count within the year, then verify uniqueness — the unique index on
  // orderNumber is the real guarantee; this loop just avoids a retry storm.
  const base = await tx.order.count({ where: { orderNumber: { startsWith: `${prefix}-${year}-` } } });
  for (let i = 1; i <= 50; i++) {
    const candidate = `${prefix}-${year}-${String(base + i).padStart(4, '0')}`;
    const clash = await tx.order.findUnique({ where: { orderNumber: candidate }, select: { id: true } });
    if (!clash) return candidate;
  }
  return `${prefix}-${year}-${Date.now().toString(36).toUpperCase()}`;
}

export const OrderService = {
  /**
   * Creates an order from the caller's cart.
   *
   * Everything that matters is recomputed here from the database:
   *   • variant prices are re-read (client totals are ignored entirely)
   *   • stock is re-validated and reserved under a row-level guard
   *   • the coupon is re-evaluated against the real line set
   *   • the whole thing runs in one transaction, so a stock failure on the
   *     last line rolls back the order, the reservations and the coupon count
   */
  async createFromCart(
    input: CheckoutInput,
    options: CreateOrderOptions = {},
  ): Promise<{ order: OrderDTO; alreadyExisted: boolean }> {
    // Idempotency: a replayed submit returns the original order untouched.
    const prior = await prisma.order.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true },
    });
    if (prior) {
      const existing = await this.getById(prior.id);
      if (existing) return { order: existing, alreadyExisted: true };
    }

    // "Buy now" bypasses the cart completely; normal checkout reads it.
    const explicitLines = input.lines?.length ? input.lines : null;
    const usesCart = !explicitLines && !input.buyNow;

    const cart = usesCart ? await CartService.resolveCart(input.userId, false) : null;
    if (usesCart && (!cart || cart.items.length === 0)) throw badRequest('Your bag is empty.');

    /** The lines being purchased, whatever their source. */
    const sourceItems: { variantId: string; quantity: number }[] =
      explicitLines ?? (input.buyNow ? [input.buyNow] : cart!.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })));

    const settings = await getSettings();
    if (input.paymentMethod === PaymentMethod.COD && !settings['shipping.cod_enabled']) {
      throw badRequest('Cash on delivery is not available right now.');
    }

    // Re-read every variant from the database. Nothing is taken from the client.
    const variantIds = sourceItems.map((i) => i.variantId);
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, isActive: true, deletedAt: null },
      select: {
        id: true, sku: true, price: true, compareAtPrice: true,
        size: { select: { label: true } },
        color: { select: { name: true } },
        product: {
          select: {
            id: true, name: true, slug: true, status: true, deletedAt: true,
            images: { orderBy: { position: 'asc' }, take: 1, select: { url: true, isPlaceholder: true } },
            categories: { select: { categoryId: true } },
          },
        },
      },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));

    const resolved = sourceItems
      .map((item) => ({ item, variant: byId.get(item.variantId) }))
      .filter((r): r is { item: { variantId: string; quantity: number }; variant: (typeof variants)[number] } =>
        Boolean(r.variant && r.variant.product.status === 'ACTIVE' && !r.variant.product.deletedAt));

    if (resolved.length === 0) {
      throw badRequest(
        input.buyNow
          ? 'This item is no longer available.'
          : 'The items in your bag are no longer available.',
      );
    }

    const priceable = resolved.map(({ item, variant }) => ({
      productId: variant.product.id,
      variantId: variant.id,
      categoryIds: variant.product.categories.map((c) => c.categoryId),
      unitPricePaise: toPaise(variant.price),
      quantity: item.quantity,
    }));

    // Authoritative totals.
    const priced = await quote({
      lines: priceable,
      // A buy-now purchase does not inherit a coupon attached to the cart.
      // Only a cart-sourced order inherits the coupon attached to the bag; a
      // buy-now or a settled intent carries its own or none.
      couponCode: input.couponCode ?? (usesCart ? cart!.coupon?.code : null) ?? null,
      paymentMethod: input.paymentMethod,
      userId: input.userId,
    });

    if (input.couponCode && priced.couponError) {
      throw new AppError('COUPON_INVALID', priced.couponError);
    }

    const b = priced.breakdown;

    const order = await prisma.$transaction(
      async (tx) => {
        // Reserve first — this is what actually prevents overselling.
        if (options.reserve !== false) {
          await InventoryService.reserve(
            tx,
            priceable.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
            undefined,
            input.userId ?? undefined,
          );
        }

        let addressId: string | null = null;
        if (input.userId && input.saveAddress && input.address) {
          const saved = await tx.address.create({
            data: {
              userId: input.userId,
              fullName: input.address.fullName,
              phone: input.address.phone,
              email: input.email,
              line1: input.address.line1,
              line2: input.address.line2 ?? null,
              landmark: input.address.landmark ?? null,
              city: input.address.city,
              state: input.address.state,
              pincode: input.address.pincode,
              country: input.address.country || 'India',
            },
          });
          addressId = saved.id;
        }

        const orderNumber = await nextOrderNumber(tx);

        const created = await tx.order.create({
          data: {
            orderNumber,
            userId: input.userId,
            email: input.email,
            phone: input.phone,
            shippingAddressId: addressId,
            addressSnapshot: (input.address ?? undefined) as unknown as Prisma.InputJsonValue,
            status: OrderStatus.PENDING,
            paymentMethod: input.paymentMethod,
            subtotal: toDecimal(b.subtotalPaise),
            discountTotal: toDecimal(b.discountPaise),
            shippingTotal: toDecimal(b.shippingPaise),
            handlingTotal: toDecimal(b.handlingPaise),
            codFee: toDecimal(b.codFeePaise),
            taxTotal: toDecimal(b.taxPaise),
            grandTotal: toDecimal(b.totalPaise),
            couponId: priced.coupon?.couponId ?? null,
            couponCode: priced.coupon?.code ?? null,
            customerNote: input.customerNote?.slice(0, 1000) ?? null,
            idempotencyKey: input.idempotencyKey,
            // Recorded so a later payment success (webhook or return-URL
            // verify, neither of which has the customer's session) knows
            // exactly which cart to empty. Null for "Buy now", which never
            // touches the bag.
            sourceCartId: cart?.id ?? null,
            items: {
              create: resolved.map(({ item, variant }, i) => {
                const unit = priceable[i].unitPricePaise;
                const discount = priced.lineDiscounts[i] ?? 0;
                const img = variant.product.images[0];
                return {
                  productId: variant.product.id,
                  variantId: variant.id,
                  productName: variant.product.name,
                  variantLabel: [variant.color?.name, variant.size?.label].filter(Boolean).join(' / ') || null,
                  sku: variant.sku,
                  imageUrl: img && !img.isPlaceholder ? img.url : null,
                  unitPrice: toDecimal(unit),
                  compareAtPrice: variant.compareAtPrice ?? null,
                  quantity: item.quantity,
                  discount: toDecimal(discount),
                  lineTotal: toDecimal(unit * item.quantity - discount),
                };
              }),
            },
            events: {
              create: { status: OrderStatus.PENDING, message: 'Order placed.', source: 'checkout' },
            },
          },
          select: { id: true },
        });

        if (priced.coupon) {
          await CouponService.recordUsage(tx, {
            couponId: priced.coupon.couponId,
            orderId: created.id,
            userId: input.userId,
            amountPaise: priced.coupon.discountPaise,
          });
        }

        // COD has no gateway step, so it is confirmed immediately and the
        // reservation converts to a real stock decrement here.
        if (input.paymentMethod === PaymentMethod.COD) {
          await tx.payment.create({
            data: {
              orderId: created.id,
              provider: 'cod',
              method: PaymentMethod.COD,
              status: PaymentStatus.PENDING,
              amount: toDecimal(b.totalPaise),
            },
          });
          await InventoryService.commit(
            tx,
            priceable.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
            created.id,
          );
          await tx.order.update({
            where: { id: created.id },
            data: { status: OrderStatus.CONFIRMED, confirmedAt: new Date() },
          });
          await tx.orderEvent.create({
            data: { orderId: created.id, status: OrderStatus.CONFIRMED, message: 'Cash on delivery order confirmed.', source: 'checkout' },
          });

          // COD has no payment step to wait for, so the order is already
          // confirmed above — the bag can empty right away. A prepaid order
          // leaves the bag untouched until `markPaid` actually settles it, so
          // a failed or abandoned payment doesn't lose the customer's items.
          if (cart) {
            await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
            await tx.cart.update({ where: { id: cart.id }, data: { couponId: null } });
          }
        }

        return created;
      },
      { timeout: 20_000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );

    const dto = await this.getById(order.id);
    if (!dto) throw new AppError('INTERNAL_ERROR', 'Order was created but could not be read back.');
    if (input.paymentMethod === PaymentMethod.COD) {
      await PurchaseTrackingService.reportConfirmedOrder(order.id);
    }
    return { order: dto, alreadyExisted: false };
  },

  /**
   * Confirms a prepaid order once payment is verified server-side.
   * Idempotent — a webhook and a return-URL verify can both call it.
   */
  async markPaid(orderId: string, source: string, message = 'Payment received.'): Promise<void> {
    const newlyConfirmed = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { select: { variantId: true, quantity: true } } },
      });
      if (!order) return false;
      if (order.status !== OrderStatus.PENDING) return false; // already handled

      await InventoryService.commit(
        tx,
        order.items
          .filter((i): i is { variantId: string; quantity: number } => Boolean(i.variantId))
          .map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        order.id,
      );

      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CONFIRMED, confirmedAt: new Date() },
      });
      await tx.orderEvent.create({
        data: { orderId: order.id, status: OrderStatus.CONFIRMED, message, source },
      });

      // The bag was deliberately left alone at checkout for a prepaid order —
      // now that payment has actually settled, empty the cart it came from.
      if (order.sourceCartId) {
        await tx.cartItem.deleteMany({ where: { cartId: order.sourceCartId } });
        await tx.cart.update({ where: { id: order.sourceCartId }, data: { couponId: null } }).catch(() => undefined);
      }
      return true;
    });

    if (newlyConfirmed) {
      await PurchaseTrackingService.reportConfirmedOrder(orderId);
    }
  },

  /** Releases the reservation when a gateway reports failure. */
  async markPaymentFailed(orderId: string, reason: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { select: { variantId: true, quantity: true } } },
      });
      if (!order || order.status !== OrderStatus.PENDING) return;

      await InventoryService.release(
        tx,
        order.items
          .filter((i): i is { variantId: string; quantity: number } => Boolean(i.variantId))
          .map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        order.id,
      );
      await CouponService.releaseUsage(tx, order.id);

      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED, cancelledAt: new Date(), cancelReason: reason },
      });
      await tx.orderEvent.create({
        data: { orderId: order.id, status: OrderStatus.CANCELLED, message: reason, source: 'payment' },
      });
    });
  },

  async cancel(orderId: string, reason: string, actorId?: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { select: { variantId: true, quantity: true } } },
      });
      if (!order) throw notFound('Order not found.');
      if (!CANCELLABLE.includes(order.status)) {
        throw conflict('This order can no longer be cancelled.');
      }

      const lines = order.items
        .filter((i): i is { variantId: string; quantity: number } => Boolean(i.variantId))
        .map((i) => ({ variantId: i.variantId, quantity: i.quantity }));

      // PENDING orders still hold a reservation; confirmed orders already
      // decremented stock, so those are restocked instead.
      if (order.status === OrderStatus.PENDING) {
        await InventoryService.release(tx, lines, order.id, InventoryReason.CANCELLATION);
      } else {
        await InventoryService.restock(tx, lines, order.id, InventoryReason.CANCELLATION);
      }

      await CouponService.releaseUsage(tx, order.id);
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED, cancelledAt: new Date(), cancelReason: reason.slice(0, 255) },
      });
      await tx.orderEvent.create({
        data: { orderId: order.id, status: OrderStatus.CANCELLED, message: reason, source: actorId ? 'admin' : 'customer', actorId },
      });
    });

    // Fulfilment is manual, so this only marks the shipment row cancelled —
    // staff are responsible for stopping a dispatch already handed to a courier.
    const shipment = await prisma.shipment.findFirst({ where: { orderId, status: { not: 'CANCELLED' } } });
    if (shipment) {
      const { ShippingService } = await import('./shipping.service');
      await ShippingService.cancelShipment(shipment.id, actorId).catch((e) =>
        console.error('[orders] shipment cancel', e),
      );
    }
  },

  async requestReturn(orderId: string, reason: string, userId?: string): Promise<void> {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw notFound('Order not found.');
    if (userId && order.userId !== userId) throw notFound('Order not found.');
    if (order.status !== OrderStatus.DELIVERED) {
      throw conflict('Only delivered orders can be returned.');
    }
    if (order.deliveredAt && Date.now() - order.deliveredAt.getTime() > RETURN_WINDOW_DAYS * 864e5) {
      throw conflict(`The ${RETURN_WINDOW_DAYS}-day return window has closed for this order.`);
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.RETURN_REQUESTED,
          returnRequestedAt: new Date(),
          returnReason: reason.slice(0, 255),
        },
      }),
      prisma.orderEvent.create({
        data: { orderId, status: OrderStatus.RETURN_REQUESTED, message: reason, source: 'customer' },
      }),
    ]);
  },

  /** Admin status transition, with the stock consequences applied. */
  async updateStatus(orderId: string, status: OrderStatus, actorId: string, message?: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { select: { variantId: true, quantity: true } } },
      });
      if (!order) throw notFound('Order not found.');
      if (order.status === status) return;

      if (status === OrderStatus.RETURNED) {
        await InventoryService.restock(
          tx,
          order.items
            .filter((i): i is { variantId: string; quantity: number } => Boolean(i.variantId))
            .map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          order.id,
          InventoryReason.RETURN,
        );
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status,
          deliveredAt: status === OrderStatus.DELIVERED ? new Date() : order.deliveredAt,
          cancelledAt: status === OrderStatus.CANCELLED ? new Date() : order.cancelledAt,
        },
      });
      await tx.orderEvent.create({
        data: { orderId, status, message: message ?? `Status changed to ${status}.`, source: 'admin', actorId },
      });
    });
  },

  // ─────────────────────────────── Reads ────────────────────────────────

  async getById(orderId: string, userId?: string): Promise<OrderDTO | null> {
    const order = await prisma.order.findFirst({
      where: { id: orderId, ...(userId ? { userId } : {}) },
      include: {
        items: { include: { product: { select: { slug: true } } } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        shipments: { orderBy: { createdAt: 'desc' }, take: 1 },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    return order ? serializeOrder(order) : null;
  },

  async getByNumber(orderNumber: string, email?: string): Promise<OrderDTO | null> {
    const order = await prisma.order.findFirst({
      // The email check is what stops order numbers being enumerated by guests.
      where: { orderNumber, ...(email ? { email } : {}) },
      include: {
        items: { include: { product: { select: { slug: true } } } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        shipments: { orderBy: { createdAt: 'desc' }, take: 1 },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    return order ? serializeOrder(order) : null;
  },

  async listForUser(userId: string, page = 1, perPage = 10) {
    /**
     * An express checkout has to create the order before it can open a
     * payment session, so a customer who never finished paying has a PENDING
     * prepaid order sitting against their account. That is not an order they
     * placed, and listing it tells them the opposite — so it is hidden here.
     * It stays reachable by its own confirmation URL, and is cancelled for
     * real by the release route or the expiry sweep.
     *
     * Nothing else is hidden: a COD order is CONFIRMED the moment it is
     * placed, and a paid order leaves PENDING the moment it settles.
     */
    const where: Prisma.OrderWhereInput = {
      userId,
      NOT: { status: OrderStatus.PENDING, paymentMethod: PaymentMethod.PREPAID },
    };

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          items: { include: { product: { select: { slug: true } } } },
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
          shipments: { orderBy: { createdAt: 'desc' }, take: 1 },
          events: { orderBy: { createdAt: 'asc' } },
        },
      }),
    ]);
    return {
      data: orders.map(serializeOrder),
      total,
      page,
      perPage,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    };
  },
};

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    items: { include: { product: { select: { slug: true } } } };
    payments: true;
    shipments: true;
    events: true;
  };
}>;

function serializeOrder(order: OrderWithRelations): OrderDTO {
  const payment = order.payments[0] ?? null;
  const shipment = order.shipments[0] ?? null;

  const items: OrderItemDTO[] = order.items.map((i) => ({
    id: i.id,
    productId: i.productId,
    productName: i.productName,
    variantLabel: i.variantLabel,
    sku: i.sku,
    slug: i.product?.slug ?? null,
    imageUrl: i.imageUrl,
    unitPricePaise: toPaise(i.unitPrice),
    quantity: i.quantity,
    lineTotalPaise: toPaise(i.lineTotal),
  }));

  const withinReturnWindow =
    order.status === OrderStatus.DELIVERED &&
    Boolean(order.deliveredAt) &&
    Date.now() - order.deliveredAt!.getTime() <= RETURN_WINDOW_DAYS * 864e5;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: payment?.status ?? null,
    items,
    subtotalPaise: toPaise(order.subtotal),
    discountPaise: toPaise(order.discountTotal),
    shippingPaise: toPaise(order.shippingTotal),
    handlingPaise: toPaise(order.handlingTotal),
    codFeePaise: toPaise(order.codFee),
    taxPaise: toPaise(order.taxTotal),
    totalPaise: toPaise(order.grandTotal),
    couponCode: order.couponCode,
    address: (order.addressSnapshot as unknown as AddressSnapshot) ?? null,
    shipment: shipment
      ? {
          status: shipment.status,
          awbCode: shipment.awbCode,
          courierName: shipment.courierName,
          trackingUrl: shipment.trackingUrl,
          expectedDelivery: shipment.expectedDelivery?.toISOString() ?? null,
          shippedAt: shipment.shippedAt?.toISOString() ?? null,
          deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
        }
      : null,
    timeline: order.events.map((e) => ({
      status: e.status,
      message: e.message,
      at: e.createdAt.toISOString(),
    })),
    canCancel: CANCELLABLE.includes(order.status),
    canReturn: withinReturnWindow,
    placedAt: order.placedAt.toISOString(),
  };
}
