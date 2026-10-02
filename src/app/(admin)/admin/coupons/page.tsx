import type { Metadata } from 'next';
import { requirePermission, getCurrentUser } from '@/lib/auth/session';
import { can } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { CouponManager } from '@/components/admin/coupon-manager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Coupons' };

export default async function AdminCouponsPage() {
  await requirePermission('coupons.read');
  const user = await getCurrentUser();

  const [coupons, categories, products] = await Promise.all([
    prisma.coupon.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        products: { select: { id: true } },
        categories: { select: { id: true } },
        _count: { select: { usages: true } },
      },
    }),
    prisma.category.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl">Coupons</h1>
        <p className="mt-1 text-sm text-muted">
          Every rule here is enforced server-side at checkout — a code cannot be applied by editing the page.
        </p>
      </header>

      <CouponManager
        canWrite={Boolean(user && can(user.role, 'coupons.write'))}
        categories={categories}
        products={products}
        coupons={coupons.map((c) => ({
          id: c.id,
          code: c.code,
          description: c.description,
          type: c.type,
          value: Number(c.value),
          minOrderAmount: c.minOrderAmount ? Number(c.minOrderAmount) : null,
          maxDiscount: c.maxDiscount ? Number(c.maxDiscount) : null,
          usageLimit: c.usageLimit,
          perUserLimit: c.perUserLimit,
          usedCount: c.usedCount,
          startsAt: c.startsAt ? c.startsAt.toISOString().slice(0, 10) : '',
          expiresAt: c.expiresAt ? c.expiresAt.toISOString().slice(0, 10) : '',
          isActive: c.isActive,
          appliesToSubset: c.appliesToSubset,
          freeShipping: c.freeShipping,
          firstOrderOnly: c.firstOrderOnly,
          productIds: c.products.map((p) => p.id),
          categoryIds: c.categories.map((x) => x.id),
        }))}
      />
    </div>
  );
}
