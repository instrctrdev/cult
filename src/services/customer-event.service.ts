import 'server-only';
import { CustomerEventType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/** A product page re-rendering must not look like a fresh visit. */
const VIEW_DEDUPE_MINUTES = 30;

/**
 * Records what a shopper did, for the automations to read later.
 *
 * Never throws: analytics must not be able to break a product page or an
 * add-to-cart. A lost event costs a reminder, a thrown one costs a sale.
 */
export const CustomerEventService = {
  /** Associates activity from this browser with the customer after sign-in. */
  async claimGuestEvents(userId: string, guestTokens: Array<string | null | undefined>): Promise<void> {
    const tokens = [...new Set(guestTokens.filter((token): token is string => Boolean(token)))];
    if (tokens.length === 0) return;

    try {
      await prisma.customerEvent.updateMany({
        where: { guestToken: { in: tokens }, userId: null, processedAt: null },
        data: { userId, guestToken: null },
      });
    } catch (err) {
      console.error('[events] claiming guest activity failed', err);
    }
  },

  async record(input: {
    eventType: CustomerEventType;
    userId?: string | null;
    guestToken?: string | null;
    productId?: string | null;
    cartId?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    try {
      // Nothing to attribute the event to, so nothing to act on later.
      if (!input.userId && !input.guestToken) return;

      if (input.eventType === CustomerEventType.PRODUCT_VIEW && input.productId) {
        const since = new Date(Date.now() - VIEW_DEDUPE_MINUTES * 60 * 1000);
        const recent = await prisma.customerEvent.findFirst({
          where: {
            eventType: CustomerEventType.PRODUCT_VIEW,
            productId: input.productId,
            createdAt: { gte: since },
            ...(input.userId ? { userId: input.userId } : { guestToken: input.guestToken }),
          },
          select: { id: true },
        });
        if (recent) return;
      }

      await prisma.customerEvent.create({
        data: {
          eventType: input.eventType,
          userId: input.userId ?? null,
          guestToken: input.userId ? null : input.guestToken ?? null,
          productId: input.productId ?? null,
          cartId: input.cartId ?? null,
          metadata: (input.metadata ?? undefined) as never,
        },
      });
    } catch (err) {
      console.error('[events] recording failed', { eventType: input.eventType }, err);
    }
  },

  /**
   * Marks every pending reminder for these products as handled, because the
   * customer has now bought them — the whole point of the reminder is gone.
   */
  async cancelPendingFor(userId: string | null, productIds: string[]): Promise<void> {
    if (!userId) return;
    try {
      await prisma.customerEvent.updateMany({
        where: {
          userId,
          processedAt: null,
          eventType: { in: [CustomerEventType.PRODUCT_VIEW, CustomerEventType.ADD_TO_CART] },
          ...(productIds.length ? { OR: [{ productId: { in: productIds } }, { productId: null }] } : {}),
        },
        data: { processedAt: new Date() },
      });
    } catch (err) {
      console.error('[events] cancelling pending reminders failed', err);
    }
  },
};
