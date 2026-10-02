import 'server-only';
import { InventoryReason, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { outOfStock } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface StockLine {
  variantId: string;
  quantity: number;
}

/**
 * Inventory is variant-level and reservation-based.
 *
 *   available = quantity - reserved
 *
 * Checkout reserves before payment and converts the reservation to a sale on
 * confirmation, so two customers cannot buy the last unit of the same size.
 * Every mutation appends to InventoryLedger — nothing changes silently.
 */
export const InventoryService = {
  async availableFor(variantIds: string[]): Promise<Map<string, number>> {
    if (!variantIds.length) return new Map();
    const rows = await prisma.inventory.findMany({
      where: { variantId: { in: variantIds } },
      select: { variantId: true, quantity: true, reserved: true, allowBackorder: true },
    });
    return new Map(
      rows.map((r) => [
        r.variantId,
        r.allowBackorder ? Number.MAX_SAFE_INTEGER : Math.max(0, r.quantity - r.reserved),
      ]),
    );
  },

  /**
   * Reserves stock for every line atomically.
   *
   * The conditional `updateMany` is the concurrency guard: MySQL evaluates
   * `quantity - reserved >= n` while holding the row lock, so a losing racer
   * updates zero rows and the whole transaction rolls back.
   */
  async reserve(tx: Tx, lines: StockLine[], orderId?: string, actorId?: string): Promise<void> {
    for (const line of lines) {
      const inv = await tx.inventory.findUnique({
        where: { variantId: line.variantId },
        select: { id: true, quantity: true, reserved: true, allowBackorder: true },
      });

      if (!inv) {
        throw outOfStock('This item is no longer available.', { variantId: line.variantId });
      }

      if (!inv.allowBackorder) {
        const updated = await tx.$executeRaw`
          UPDATE Inventory
             SET reserved = reserved + ${line.quantity},
                 updatedAt = NOW(3)
           WHERE id = ${inv.id}
             AND quantity - reserved >= ${line.quantity}
        `;
        if (updated === 0) {
          const fresh = await tx.inventory.findUnique({
            where: { id: inv.id },
            select: { quantity: true, reserved: true },
          });
          throw outOfStock('Someone just took the last of this size.', {
            variantId: line.variantId,
            available: Math.max(0, (fresh?.quantity ?? 0) - (fresh?.reserved ?? 0)),
            requested: line.quantity,
          });
        }
      } else {
        await tx.inventory.update({
          where: { id: inv.id },
          data: { reserved: { increment: line.quantity } },
        });
      }

      const after = await tx.inventory.findUniqueOrThrow({
        where: { id: inv.id },
        select: { quantity: true, reserved: true },
      });
      await tx.inventoryLedger.create({
        data: {
          inventoryId: inv.id,
          reason: InventoryReason.RESERVATION,
          reservedDelta: line.quantity,
          quantityAfter: after.quantity,
          reservedAfter: after.reserved,
          orderId,
          actorId,
        },
      });
    }
  },

  /** Releases a reservation — payment failed, or the order was cancelled. */
  async release(tx: Tx, lines: StockLine[], orderId?: string, reason: InventoryReason = InventoryReason.RELEASE): Promise<void> {
    for (const line of lines) {
      const inv = await tx.inventory.findUnique({
        where: { variantId: line.variantId },
        select: { id: true, reserved: true },
      });
      if (!inv) continue;

      // Clamp so a double release can never drive `reserved` negative.
      const delta = Math.min(line.quantity, inv.reserved);
      if (delta <= 0) continue;

      const after = await tx.inventory.update({
        where: { id: inv.id },
        data: { reserved: { decrement: delta } },
        select: { quantity: true, reserved: true },
      });
      await tx.inventoryLedger.create({
        data: {
          inventoryId: inv.id,
          reason,
          reservedDelta: -delta,
          quantityAfter: after.quantity,
          reservedAfter: after.reserved,
          orderId,
        },
      });
    }
  },

  /** Converts a reservation into a real stock decrement once payment lands. */
  async commit(tx: Tx, lines: StockLine[], orderId: string): Promise<void> {
    for (const line of lines) {
      const inv = await tx.inventory.findUnique({
        where: { variantId: line.variantId },
        select: { id: true, quantity: true, reserved: true },
      });
      if (!inv) continue;

      const releaseQty = Math.min(line.quantity, Math.max(0, inv.reserved));

      // On-hand stock is a physical count: it cannot be less than nothing.
      // Without this floor a commit for stock that is not there wrote a
      // negative quantity, and `quantity - reserved` then reported *more*
      // available than exists — the arithmetic that lets the next customer
      // buy something already sold.
      const decrement = Math.min(line.quantity, Math.max(0, inv.quantity));
      if (decrement < line.quantity) {
        console.error('[inventory] commit exceeded stock on hand', {
          variantId: line.variantId,
          orderId,
          wanted: line.quantity,
          onHand: inv.quantity,
        });
      }

      const after = await tx.inventory.update({
        where: { id: inv.id },
        data: {
          quantity: { decrement },
          reserved: { decrement: releaseQty },
        },
        select: { quantity: true, reserved: true },
      });
      await tx.inventoryLedger.create({
        data: {
          inventoryId: inv.id,
          reason: InventoryReason.SALE,
          quantityDelta: -decrement,
          reservedDelta: -releaseQty,
          quantityAfter: after.quantity,
          reservedAfter: after.reserved,
          orderId,
        },
      });
    }
  },

  /** Puts stock back after a cancellation or return. */
  async restock(tx: Tx, lines: StockLine[], orderId: string, reason: InventoryReason): Promise<void> {
    for (const line of lines) {
      const inv = await tx.inventory.findUnique({
        where: { variantId: line.variantId },
        select: { id: true },
      });
      if (!inv) continue;

      const after = await tx.inventory.update({
        where: { id: inv.id },
        data: { quantity: { increment: line.quantity } },
        select: { quantity: true, reserved: true },
      });
      await tx.inventoryLedger.create({
        data: {
          inventoryId: inv.id,
          reason,
          quantityDelta: line.quantity,
          quantityAfter: after.quantity,
          reservedAfter: after.reserved,
          orderId,
        },
      });
    }
  },

  /** Admin manual adjustment — sets an absolute on-hand figure. */
  async adjust(variantId: string, newQuantity: number, actorId: string, note?: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const inv = await tx.inventory.upsert({
        where: { variantId },
        create: { variantId, quantity: newQuantity },
        update: {},
        select: { id: true, quantity: true, reserved: true },
      });
      const delta = newQuantity - inv.quantity;
      const after = await tx.inventory.update({
        where: { id: inv.id },
        data: { quantity: newQuantity },
        select: { quantity: true, reserved: true },
      });
      await tx.inventoryLedger.create({
        data: {
          inventoryId: inv.id,
          reason: InventoryReason.MANUAL_ADJUSTMENT,
          quantityDelta: delta,
          quantityAfter: after.quantity,
          reservedAfter: after.reserved,
          actorId,
          note: note?.slice(0, 255),
        },
      });
    });
  },

  async lowStock(limit = 20) {
    return prisma.inventory.findMany({
      where: { allowBackorder: false },
      orderBy: { quantity: 'asc' },
      take: limit,
      select: {
        id: true, quantity: true, reserved: true, lowStockThreshold: true,
        variant: {
          select: {
            id: true, sku: true,
            size: { select: { code: true } },
            color: { select: { name: true } },
            product: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    }).then((rows) => rows.filter((r) => r.quantity - r.reserved <= r.lowStockThreshold));
  },

  async history(variantId: string, limit = 50) {
    return prisma.inventoryLedger.findMany({
      where: { inventory: { variantId } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },
};
