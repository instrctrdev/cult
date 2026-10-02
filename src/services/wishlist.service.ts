import 'server-only';
import { prisma } from '@/lib/prisma';
import type { ProductCardDTO } from '@/types';

/**
 * Wishlists are account-bound. Guests keep a local list in the browser and it
 * is pushed here on sign-in via `mergeLocal`.
 */
export const WishlistService = {
  async ensure(userId: string) {
    return prisma.wishlist.upsert({ where: { userId }, create: { userId }, update: {} });
  },

  async list(userId: string): Promise<ProductCardDTO[]> {
    const wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      select: {
        items: {
          orderBy: { createdAt: 'desc' },
          select: { productId: true },
        },
      },
    });
    if (!wishlist?.items.length) return [];

    const { ProductService } = await import('./product.service');
    return ProductService.byIds(wishlist.items.map((i) => i.productId));
  },

  async productIds(userId: string): Promise<string[]> {
    const wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      select: { items: { select: { productId: true } } },
    });
    return wishlist?.items.map((i) => i.productId) ?? [];
  },

  async toggle(userId: string, productId: string): Promise<{ added: boolean }> {
    const wishlist = await this.ensure(userId);
    const existing = await prisma.wishlistItem.findFirst({
      where: { wishlistId: wishlist.id, productId },
      select: { id: true },
    });

    if (existing) {
      await prisma.wishlistItem.delete({ where: { id: existing.id } });
      return { added: false };
    }
    await prisma.wishlistItem.create({ data: { wishlistId: wishlist.id, productId } });
    return { added: true };
  },

  async remove(userId: string, productId: string): Promise<void> {
    const wishlist = await prisma.wishlist.findUnique({ where: { userId }, select: { id: true } });
    if (wishlist) await prisma.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id, productId } });
  },

  /** Folds a guest's locally-stored wishlist into the account on login. */
  async mergeLocal(userId: string, productIds: string[]): Promise<void> {
    if (!productIds.length) return;
    const wishlist = await this.ensure(userId);

    const valid = await prisma.product.findMany({
      where: { id: { in: productIds.slice(0, 100) }, deletedAt: null },
      select: { id: true },
    });

    await prisma.wishlistItem.createMany({
      data: valid.map((p) => ({ wishlistId: wishlist.id, productId: p.id })),
      skipDuplicates: true,
    });
  },
};
