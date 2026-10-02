import 'server-only';
import { randomBytes } from 'crypto';
import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { badRequest, notFound } from '@/lib/errors';
import { toDecimal } from '@/lib/money';
import { OrderService } from './order.service';
import { PaymentService, paymentProvider } from './payment.service';
import type { OrderDTO } from '@/types';

export interface IntentLine {
  variantId: string;
  quantity: number;
}

/**
 * A checkout that has been started but not paid for.
 *
 * Express checkout needs an id to open a gateway session against. Creating the
 * real order to get one meant an abandoned payment left behind an order the
 * customer never placed, and stock reserved against it — so nothing is created
 * here. The intent records what *would* be bought, and the order is built only
 * once the gateway confirms the money arrived.
 *
 * The consequence, deliberately accepted: stock is not held while the customer
 * pays, so two people can pay for the last one. `settle` still creates both
 * orders rather than silently dropping a payment — `InventoryService.commit`
 * logs the shortfall so it surfaces instead of corrupting the count.
 */
export const CheckoutIntentService = {
  /** `CU-C-…` — distinct from an order number, which does not exist yet. */
  newReference(): string {
    return `CU-C-${randomBytes(9).toString('base64url').replace(/[^A-Za-z0-9]/g, '')}`;
  },

  async create(input: {
    idempotencyKey: string;
    userId: string | null;
    email: string;
    phone: string;
    lines: IntentLine[];
    couponCode: string | null;
    cartId: string | null;
    amountPaise: number;
  }) {
    // A double-tapped button reuses the intent rather than opening a second
    // gateway session for the same purchase.
    const existing = await prisma.checkoutIntent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;

    return prisma.checkoutIntent.create({
      data: {
        reference: this.newReference(),
        idempotencyKey: input.idempotencyKey,
        userId: input.userId,
        email: input.email,
        phone: input.phone,
        lines: input.lines as unknown as Prisma.InputJsonValue,
        couponCode: input.couponCode,
        cartId: input.cartId,
        amountPaise: input.amountPaise,
        // Retained only for schema compatibility with historic checkout rows.
        whatsappOptIn: false,
        guestTokens: [] as unknown as Prisma.InputJsonValue,
      },
    });
  },

  /**
   * Turns a paid intent into a real order. Safe to call repeatedly and from
   * anywhere — the browser when the sheet closes, the webhook, or the sweep —
   * because the first call to succeed claims the intent and the rest return
   * that same order.
   */
  async settle(reference: string): Promise<{ paid: boolean; order: OrderDTO | null }> {
    const intent = await prisma.checkoutIntent.findUnique({ where: { reference } });
    if (!intent) throw notFound('That checkout could not be found.');

    if (intent.orderId) return { paid: true, order: await OrderService.getById(intent.orderId) };

    const result = await paymentProvider().verifyPayment(reference);
    if (result.status !== PaymentStatus.PAID) return { paid: false, order: null };

    // Cashfree reports a COD selection as a PAID order with payment_group
    // "cash" — an accepted order, not money received.
    const isCod = Boolean(result.isCashOnDelivery);

    const lines = intent.lines as unknown as IntentLine[];
    const { order } = await OrderService.createFromCart(
      {
        userId: intent.userId,
        email: intent.email,
        phone: intent.phone,
        address: null,
        saveAddress: false,
        paymentMethod: isCod ? PaymentMethod.COD : PaymentMethod.PREPAID,
        couponCode: intent.couponCode,
        idempotencyKey: intent.idempotencyKey,
        lines,
      },
      // Payment already happened; confirming commits the stock outright, so
      // reserving first would be a reservation released a moment later.
      { reserve: false },
    );

    // Claim the intent before anything else can, so a webhook and a browser
    // arriving together cannot both build an order.
    await prisma.checkoutIntent.update({ where: { id: intent.id }, data: { orderId: order.id } });

    const existingPayment = await prisma.payment.findFirst({ where: { orderId: order.id } });
    const paymentData = {
      provider: paymentProvider().name,
      method: isCod ? PaymentMethod.COD : PaymentMethod.PREPAID,
      // COD owes cash on delivery: an accepted order, never a received payment.
      status: isCod ? PaymentStatus.PENDING : PaymentStatus.PAID,
      amount: toDecimal(result.paidAmountPaise ?? intent.amountPaise),
      providerOrderId: reference,
      providerPaymentId: result.providerPaymentId ?? undefined,
      providerPayload: result.raw as Prisma.InputJsonValue,
      paidAt: isCod ? null : new Date(),
    };

    // The order and the money are what matter; a failure to write the payment
    // record must not fail the settle and leave the caller believing nothing
    // happened. It is logged for reconciliation instead.
    try {
      if (existingPayment) {
        await prisma.payment.update({ where: { id: existingPayment.id }, data: paymentData });
      } else {
        await prisma.payment.create({ data: { ...paymentData, orderId: order.id, currency: 'INR' } });
      }
    } catch (err) {
      console.error('[checkout] recording the payment failed', { reference, orderId: order.id }, err);
    }

    // The address One Click Checkout collected only exists at the gateway.
    await PaymentService.captureCollectedAddress(order.id, reference);

    // The gateway charged its own delivery on top of what we sent it, so the
    // order still records items only. Correct it to the money actually taken
    // before the customer ever sees the order.
    await PaymentService.reconcileCharges(order.id, reference, result.paidAmountPaise);

    // A COD order is already confirmed and its stock committed by
    // `createFromCart`; a prepaid one still needs confirming.
    if (!isCod) {
      await OrderService.markPaid(order.id, 'gateway-verify');
    }

    if (intent.cartId) {
      await prisma.cartItem.deleteMany({ where: { cartId: intent.cartId } }).catch(() => undefined);
      await prisma.cart.update({ where: { id: intent.cartId }, data: { couponId: null } }).catch(() => undefined);
    }

    const settled = await OrderService.getById(order.id);
    if (!settled) throw badRequest('The order was created but could not be read back.');

    return { paid: true, order: settled };
  },
};
