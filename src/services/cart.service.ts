import 'server-only';
import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { badRequest, notFound, outOfStock } from '@/lib/errors';
import { toPaise } from '@/lib/money';
import { GUEST_CART_COOKIE } from '@/lib/auth/session';
import { quote, type PriceableLine } from './pricing.service';
import type { CartDTO, CartLineDTO } from '@/types';

const CART_TTL_DAYS = 30;
const MAX_QTY_PER_LINE = 10;

const cartInclude = {
  coupon: { select: { code: true } },
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      product: {
        select: {
          id: true, slug: true, name: true, status: true, deletedAt: true,
          images: { orderBy: { position: 'asc' }, take: 1, select: { url: true, isPlaceholder: true } },
          categories: { select: { categoryId: true } },
        },
      },
      variant: {
        select: {
          id: true, sku: true, price: true, compareAtPrice: true, isActive: true, deletedAt: true,
          size: { select: { code: true, label: true } },
          color: { select: { name: true } },
          inventory: { select: { quantity: true, reserved: true, allowBackorder: true } },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CartRow = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

function availableOf(inv: { quantity: number; reserved: number; allowBackorder: boolean } | null): number {
  if (!inv) return 0;
  if (inv.allowBackorder) return MAX_QTY_PER_LINE;
  return Math.max(0, inv.quantity - inv.reserved);
}

function variantLabel(v: CartRow['items'][number]['variant']): string {
  return [v.color?.name, v.size?.label].filter(Boolean).join(' / ') || 'One size';
}

/**
 * Cart identity: a signed-in customer owns a cart by userId; a guest owns one
 * by an opaque token in an httpOnly cookie. On login the guest cart is merged
 * into the account cart and discarded.
 */
export const CartService = {
  /** Finds or creates the caller's cart. `create=false` avoids writes on reads. */
  async resolveCart(userId: string | null, create = true): Promise<CartRow | null> {
    const store = await cookies();

    if (userId) {
      const existing = await prisma.cart.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        include: cartInclude,
      });
      if (existing) return existing;
      if (!create) return null;
      return prisma.cart.create({
        data: { userId, expiresAt: new Date(Date.now() + CART_TTL_DAYS * 864e5) },
        include: cartInclude,
      });
    }

    const token = store.get(GUEST_CART_COOKIE)?.value;
    if (token) {
      const existing = await prisma.cart.findUnique({ where: { guestToken: token }, include: cartInclude });
      if (existing) return existing;
    }
    if (!create) return null;

    const newToken = randomUUID();
    store.set(GUEST_CART_COOKIE, newToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: CART_TTL_DAYS * 86400,
    });
    return prisma.cart.create({
      data: { guestToken: newToken, expiresAt: new Date(Date.now() + CART_TTL_DAYS * 864e5) },
      include: cartInclude,
    });
  },

  /**
   * Serialises a cart with fully re-computed pricing. Lines whose product went
   * away or whose stock dropped are flagged rather than silently corrected, so
   * the customer sees what changed.
   */
  async serialize(cart: CartRow | null, paymentMethod: PaymentMethod = PaymentMethod.PREPAID): Promise<CartDTO> {
    const usable = (cart?.items ?? []).filter(
      (i) =>
        i.product && !i.product.deletedAt && i.product.status === 'ACTIVE' &&
        i.variant && i.variant.isActive && !i.variant.deletedAt,
    );

    const lines: CartLineDTO[] = usable.map((item) => {
      const available = availableOf(item.variant.inventory);
      const qty = Math.min(item.quantity, Math.max(0, available));
      const unit = toPaise(item.variant.price);
      const img = item.product.images[0];

      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        slug: item.product.slug,
        name: item.product.name,
        variantLabel: variantLabel(item.variant),
        sku: item.variant.sku,
        image: img && !img.isPlaceholder ? img.url : null,
        unitPricePaise: unit,
        compareAtPaise: item.variant.compareAtPrice ? toPaise(item.variant.compareAtPrice) : null,
        quantity: qty,
        maxQuantity: Math.min(MAX_QTY_PER_LINE, available),
        lineTotalPaise: unit * qty,
        issue: available === 0 ? 'OUT_OF_STOCK' : qty < item.quantity ? 'QUANTITY_REDUCED' : null,
      };
    });

    const priceable: PriceableLine[] = usable
      .map((item, i) => ({
        productId: item.productId,
        variantId: item.variantId,
        categoryIds: item.product.categories.map((c) => c.categoryId),
        unitPricePaise: lines[i].unitPricePaise,
        quantity: lines[i].quantity,
      }))
      .filter((l) => l.quantity > 0);

    const { breakdown } = await quote({
      lines: priceable,
      couponCode: cart?.coupon?.code ?? null,
      paymentMethod,
      userId: cart?.userId ?? null,
    });

    return {
      id: cart?.id ?? '',
      lines,
      itemCount: lines.reduce((a, l) => a + l.quantity, 0),
      pricing: breakdown,
    };
  },

  async get(userId: string | null, paymentMethod?: PaymentMethod): Promise<CartDTO> {
    const cart = await this.resolveCart(userId, false);
    return this.serialize(cart, paymentMethod);
  },

  async addItem(userId: string | null, variantId: string, quantity = 1): Promise<CartDTO> {
    if (quantity < 1) throw badRequest('Quantity must be at least 1.');

    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, isActive: true, deletedAt: null },
      select: {
        id: true, productId: true,
        product: { select: { status: true, deletedAt: true } },
        inventory: { select: { quantity: true, reserved: true, allowBackorder: true } },
      },
    });
    if (!variant || variant.product.deletedAt || variant.product.status !== 'ACTIVE') {
      throw notFound('This item is no longer available.');
    }

    const cart = (await this.resolveCart(userId, true))!;
    const existing = cart.items.find((i) => i.variantId === variantId);
    const desired = (existing?.quantity ?? 0) + quantity;

    const available = availableOf(variant.inventory);
    if (available <= 0) throw outOfStock('This size is sold out.');

    const capped = Math.min(desired, available, MAX_QTY_PER_LINE);
    if (capped < desired) {
      // Still write the achievable quantity, then report the ceiling.
      await prisma.cartItem.upsert({
        where: { cartId_variantId: { cartId: cart.id, variantId } },
        create: { cartId: cart.id, productId: variant.productId, variantId, quantity: capped },
        update: { quantity: capped },
      });
      throw outOfStock(`Only ${capped} left in this size.`, { available: capped });
    }

    await prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      create: { cartId: cart.id, productId: variant.productId, variantId, quantity: capped },
      update: { quantity: capped },
    });
    await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });

    return this.get(userId);
  },

  async updateItem(userId: string | null, itemId: string, quantity: number): Promise<CartDTO> {
    const cart = await this.resolveCart(userId, false);
    if (!cart) throw notFound('Your bag is empty.');

    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw notFound('That item is not in your bag.');

    if (quantity <= 0) {
      await prisma.cartItem.delete({ where: { id: itemId } });
      return this.get(userId);
    }

    const available = availableOf(item.variant.inventory);
    const capped = Math.min(quantity, available, MAX_QTY_PER_LINE);
    if (capped <= 0) {
      await prisma.cartItem.delete({ where: { id: itemId } });
      throw outOfStock('That size just sold out and was removed from your bag.');
    }

    await prisma.cartItem.update({ where: { id: itemId }, data: { quantity: capped } });
    if (capped < quantity) throw outOfStock(`Only ${capped} left in this size.`, { available: capped });

    return this.get(userId);
  },

  async removeItem(userId: string | null, itemId: string): Promise<CartDTO> {
    const cart = await this.resolveCart(userId, false);
    if (cart) await prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
    return this.get(userId);
  },

  async clear(cartId: string): Promise<void> {
    await prisma.cartItem.deleteMany({ where: { cartId } });
    await prisma.cart.update({ where: { id: cartId }, data: { couponId: null } });
  },

  /** Validates then attaches a coupon. Throws with a readable reason if invalid. */
  async applyCoupon(userId: string | null, code: string): Promise<CartDTO> {
    const cart = await this.resolveCart(userId, false);
    if (!cart || cart.items.length === 0) throw badRequest('Add something to your bag first.');

    const dto = await this.serialize(cart);
    const { CouponService } = await import('./coupon.service');
    const evaluation = await CouponService.evaluate({
      code,
      userId,
      lines: cart.items.map((i) => {
        const line = dto.lines.find((l) => l.id === i.id);
        return {
          productId: i.productId,
          categoryIds: i.product.categories.map((c) => c.categoryId),
          subtotalPaise: line?.lineTotalPaise ?? 0,
        };
      }),
    });

    await prisma.cart.update({ where: { id: cart.id }, data: { couponId: evaluation.couponId } });
    return this.get(userId);
  },

  async removeCoupon(userId: string | null): Promise<CartDTO> {
    const cart = await this.resolveCart(userId, false);
    if (cart) await prisma.cart.update({ where: { id: cart.id }, data: { couponId: null } });
    return this.get(userId);
  },

  /**
   * Merges a guest cart into the account cart at login.
   *
   * Quantities are summed and then clamped to available stock, so merging can
   * never produce a line the customer could not have added directly.
   */
  async mergeGuestCart(userId: string): Promise<void> {
    const store = await cookies();
    const token = store.get(GUEST_CART_COOKIE)?.value;
    if (!token) return;

    const guestCart = await prisma.cart.findUnique({ where: { guestToken: token }, include: cartInclude });
    if (!guestCart || guestCart.items.length === 0) {
      store.delete(GUEST_CART_COOKIE);
      return;
    }

    const userCart =
      (await prisma.cart.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } })) ??
      (await prisma.cart.create({
        data: { userId, expiresAt: new Date(Date.now() + CART_TTL_DAYS * 864e5) },
      }));

    for (const item of guestCart.items) {
      const existing = await prisma.cartItem.findUnique({
        where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
      });
      const available = availableOf(item.variant.inventory);
      const merged = Math.min((existing?.quantity ?? 0) + item.quantity, available, MAX_QTY_PER_LINE);
      if (merged <= 0) continue;

      await prisma.cartItem.upsert({
        where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
        create: { cartId: userCart.id, productId: item.productId, variantId: item.variantId, quantity: merged },
        update: { quantity: merged },
      });
    }

    // Carry the guest's coupon over only if the account cart has none.
    if (guestCart.couponId && !userCart.couponId) {
      await prisma.cart.update({ where: { id: userCart.id }, data: { couponId: guestCart.couponId } });
    }

    await prisma.cart.delete({ where: { id: guestCart.id } }).catch(() => undefined);
    store.delete(GUEST_CART_COOKIE);
  },
};
