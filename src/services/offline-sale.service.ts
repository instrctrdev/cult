import 'server-only';
import { randomUUID } from 'node:crypto';
import { DiscountType, InventoryReason, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AppError, badRequest, outOfStock } from '@/lib/errors';
import { toDecimal, toPaise } from '@/lib/money';

export const offlineSaleInput = z.object({
  idempotencyKey: z.string().uuid(),
  items: z.array(z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(100) })).min(1).max(100),
  customerName: z.string().trim().max(150).optional(),
  customerPhone: z.string().trim().max(32).optional(),
  paymentMethod: z.enum(['CASH', 'CARD']),
  couponCode: z.string().trim().max(64).optional(),
  manualDiscountPaise: z.number().int().min(0).max(100000000).default(0),
  expectedGrandTotalPaise: z.number().int().min(0).optional(),
});

export type OfflineSaleInput = z.infer<typeof offlineSaleInput>;

function normalizedPhone(value?: string) {
  if (!value?.trim()) return null;
  const digits = value.replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(local)) throw badRequest('Enter a valid 10 digit customer phone number.');
  return local;
}

export async function quoteOfflineSale(input: OfflineSaleInput) {
  const phone = normalizedPhone(input.customerPhone);
  const quantities = new Map<string, number>();
  for (const item of input.items) quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity);
  if ([...quantities.values()].some((n) => n > 100)) throw badRequest('Maximum quantity per item is 100.');
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: [...quantities.keys()] }, isActive: true, deletedAt: null, product: { deletedAt: null } },
    include: { product: { include: { categories: { select: { categoryId: true } } } }, inventory: true },
  });
  if (variants.length !== quantities.size) throw badRequest('An item is unavailable.');
  const lines = variants.map((v) => ({ variant: v, quantity: quantities.get(v.id)!, linePaise: toPaise(v.price) * quantities.get(v.id)! }));
  for (const line of lines) {
    if (!line.variant.inventory || line.variant.inventory.quantity - line.variant.inventory.reserved < line.quantity) {
      throw outOfStock(`${line.variant.product.name} does not have enough stock.`);
    }
  }
  const subtotalPaise = lines.reduce((sum, line) => sum + line.linePaise, 0);
  if (subtotalPaise > 999999999) throw badRequest('Sale total is too large.');
  let couponDiscountPaise = 0;
  if (input.couponCode?.trim()) {
    const coupon = await prisma.coupon.findFirst({
      where: { code: input.couponCode.trim().toUpperCase(), isActive: true, deletedAt: null },
      include: { products: { select: { id: true } }, categories: { select: { id: true } }, customers: { select: { id: true } } },
    });
    const now = new Date();
    if (!coupon || (coupon.startsAt && coupon.startsAt > now) || (coupon.expiresAt && coupon.expiresAt < now) ||
      coupon.firstOrderOnly || coupon.customers.length || coupon.freeShipping ||
      (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)) {
      throw new AppError('COUPON_INVALID', 'This coupon cannot be used for a walk-in sale.');
    }
    if (coupon.perUserLimit !== null) {
      if (!phone) throw new AppError('COUPON_INVALID', 'Enter the customer phone to use this coupon.');
      const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
      const [walkInUses, onlineUses] = await Promise.all([
        prisma.offlineSale.count({ where: { couponId: coupon.id, customerPhone: phone } }),
        user ? prisma.couponUsage.count({ where: { couponId: coupon.id, userId: user.id } }) : Promise.resolve(0),
      ]);
      const prior = walkInUses + onlineUses;
      if (prior >= coupon.perUserLimit) throw new AppError('COUPON_INVALID', 'This customer has already used this coupon.');
    }
    if (coupon.minOrderAmount && subtotalPaise < toPaise(coupon.minOrderAmount)) throw new AppError('COUPON_INVALID', 'The sale does not meet the coupon minimum.');
    const productIds = new Set(coupon.products.map((p) => p.id));
    const categoryIds = new Set(coupon.categories.map((c) => c.id));
    const eligiblePaise = lines.filter((l) => !coupon.appliesToSubset || productIds.has(l.variant.productId) ||
      l.variant.product.categories.some((c) => categoryIds.has(c.categoryId))).reduce((sum, l) => sum + l.linePaise, 0);
    couponDiscountPaise = coupon.type === DiscountType.PERCENTAGE ? Math.floor(eligiblePaise * Number(coupon.value) / 100) : toPaise(coupon.value);
    if (coupon.maxDiscount) couponDiscountPaise = Math.min(couponDiscountPaise, toPaise(coupon.maxDiscount));
    couponDiscountPaise = Math.max(0, Math.min(eligiblePaise, couponDiscountPaise));
    if (!couponDiscountPaise) throw new AppError('COUPON_INVALID', 'This coupon does not discount these items.');
  }
  if (input.manualDiscountPaise > subtotalPaise - couponDiscountPaise) throw badRequest('Discount exceeds the sale total.');
  const unroundedPaise = subtotalPaise - couponDiscountPaise - input.manualDiscountPaise;
  const grandTotalPaise = Math.round(unroundedPaise / 100) * 100;
  return { subtotalPaise, couponDiscountPaise, manualDiscountPaise: input.manualDiscountPaise,
    roundOffPaise: grandTotalPaise - unroundedPaise, grandTotalPaise };
}

export async function createOfflineSale(input: OfflineSaleInput, cashierId: string) {
  const phone = normalizedPhone(input.customerPhone);
  const existing = await prisma.offlineSale.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return existing;

  const quantities = new Map<string, number>();
  for (const line of input.items) quantities.set(line.variantId, (quantities.get(line.variantId) ?? 0) + line.quantity);
  if ([...quantities.values()].some((n) => n > 100)) throw badRequest('Maximum quantity per item is 100.');

  try {
    return await prisma.$transaction(async (tx) => {
      const variants = await tx.productVariant.findMany({
        where: { id: { in: [...quantities.keys()] }, isActive: true, deletedAt: null, product: { deletedAt: null } },
        include: { product: { include: { categories: { select: { categoryId: true } } } }, size: true, color: true, inventory: true },
      });
      if (variants.length !== quantities.size) throw badRequest('An item is unavailable. Remove it and scan again.');
      const lines = variants.map((v) => {
        const quantity = quantities.get(v.id)!;
        const unitPaise = toPaise(v.price);
        return { variant: v, quantity, unitPaise, linePaise: unitPaise * quantity };
      });
      const subtotalPaise = lines.reduce((sum, l) => sum + l.linePaise, 0);
      if (subtotalPaise > 999999999) throw badRequest('Sale total is too large.');

      let couponId: string | null = null;
      let couponCode: string | null = null;
      let couponDiscountPaise = 0;
      if (input.couponCode?.trim()) {
        const code = input.couponCode.trim().toUpperCase();
        const coupon = await tx.coupon.findFirst({
          where: { code, isActive: true, deletedAt: null },
          include: { products: { select: { id: true } }, categories: { select: { id: true } }, customers: { select: { id: true } } },
        });
        const now = new Date();
        if (!coupon || (coupon.startsAt && coupon.startsAt > now) || (coupon.expiresAt && coupon.expiresAt < now) ||
          coupon.firstOrderOnly || coupon.customers.length || coupon.freeShipping) {
          throw new AppError('COUPON_INVALID', 'This coupon cannot be used for a walk-in sale.');
        }
        await tx.$queryRaw`SELECT id FROM Coupon WHERE id = ${coupon.id} FOR UPDATE`;
        if (coupon.perUserLimit !== null) {
          if (!phone) throw new AppError('COUPON_INVALID', 'Enter the customer phone to use this coupon.');
          const user = await tx.user.findUnique({ where: { phone }, select: { id: true } });
          const walkInUses = await tx.offlineSale.count({ where: { couponId: coupon.id, customerPhone: phone } });
          const onlineUses = user ? await tx.couponUsage.count({ where: { couponId: coupon.id, userId: user.id } }) : 0;
          const prior = walkInUses + onlineUses;
          if (prior >= coupon.perUserLimit) throw new AppError('COUPON_INVALID', 'This customer has already used this coupon.');
        }
        if (coupon.minOrderAmount && subtotalPaise < toPaise(coupon.minOrderAmount)) {
          throw new AppError('COUPON_INVALID', 'The sale does not meet the coupon minimum.');
        }
        const productIds = new Set(coupon.products.map((p) => p.id));
        const categoryIds = new Set(coupon.categories.map((c) => c.id));
        const eligiblePaise = lines.filter((l) => !coupon.appliesToSubset || productIds.has(l.variant.productId) ||
          l.variant.product.categories.some((c) => categoryIds.has(c.categoryId))).reduce((sum, l) => sum + l.linePaise, 0);
        couponDiscountPaise = coupon.type === DiscountType.PERCENTAGE
          ? Math.floor(eligiblePaise * Number(coupon.value) / 100)
          : toPaise(coupon.value);
        if (coupon.maxDiscount) couponDiscountPaise = Math.min(couponDiscountPaise, toPaise(coupon.maxDiscount));
        couponDiscountPaise = Math.max(0, Math.min(eligiblePaise, couponDiscountPaise));
        if (!couponDiscountPaise) throw new AppError('COUPON_INVALID', 'This coupon does not discount these items.');
        const claimed = await tx.coupon.updateMany({
          where: { id: coupon.id, isActive: true, deletedAt: null, OR: [{ usageLimit: null }, { usedCount: { lt: coupon.usageLimit ?? 0 } }] },
          data: { usedCount: { increment: 1 } },
        });
        if (!claimed.count) throw new AppError('COUPON_INVALID', 'This coupon has reached its usage limit.');
        couponId = coupon.id;
        couponCode = coupon.code;
      }
      if (input.manualDiscountPaise > subtotalPaise - couponDiscountPaise) throw badRequest('Discount exceeds the sale total.');
      const unroundedPaise = subtotalPaise - couponDiscountPaise - input.manualDiscountPaise;
      const grandPaise = Math.round(unroundedPaise / 100) * 100;
      if (input.expectedGrandTotalPaise === undefined || input.expectedGrandTotalPaise !== grandPaise) {
        throw new AppError('CONFLICT', 'The total changed. Calculate the total again before accepting payment.');
      }

      const sale = await tx.offlineSale.create({
        data: {
          receiptNumber: `OFF-${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('-', '')}-${randomUUID().slice(0, 12).toUpperCase()}`,
          idempotencyKey: input.idempotencyKey,
          customerName: input.customerName || null,
          customerPhone: phone,
          paymentMethod: input.paymentMethod,
          subtotal: toDecimal(subtotalPaise), couponId, couponCode,
          couponDiscount: toDecimal(couponDiscountPaise), manualDiscount: toDecimal(input.manualDiscountPaise),
          roundOff: toDecimal(grandPaise - unroundedPaise), grandTotal: toDecimal(grandPaise), cashierId,
        },
      });

      for (const line of lines) {
        const v = line.variant;
        const inventory = v.inventory;
        if (!inventory) throw outOfStock(`${v.product.name} has no stock record.`);
        const updated = await tx.$executeRaw`
          UPDATE Inventory SET quantity = quantity - ${line.quantity}, updatedAt = NOW(3)
          WHERE id = ${inventory.id} AND quantity - reserved >= ${line.quantity}
        `;
        if (!updated) throw outOfStock(`${v.product.name} is out of stock. Refresh and scan again.`);
        const after = await tx.inventory.findUniqueOrThrow({ where: { id: inventory.id }, select: { quantity: true, reserved: true } });
        await tx.inventoryLedger.create({ data: {
          inventoryId: inventory.id, reason: InventoryReason.SALE, quantityDelta: -line.quantity,
          quantityAfter: after.quantity, reservedAfter: after.reserved, note: `Offline ${sale.receiptNumber}`, actorId: cashierId,
        } });
        await tx.offlineSaleItem.create({ data: {
          saleId: sale.id, variantId: v.id, sku: v.sku, productName: v.product.name,
          variantLabel: [v.size?.label, v.color?.name].filter(Boolean).join(' / ') || null,
          brand: v.product.vendor, unitPrice: v.price,
          mrp: v.compareAtPrice && v.compareAtPrice.greaterThan(v.price) ? v.compareAtPrice : v.price,
          quantity: line.quantity, lineTotal: toDecimal(line.linePaise),
        } });
      }
      return sale;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const sale = await prisma.offlineSale.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (sale) return sale;
    }
    throw error;
  }
}
