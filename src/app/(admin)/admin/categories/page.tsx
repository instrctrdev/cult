import type { Metadata } from 'next';
import { requirePermission, getCurrentUser } from '@/lib/auth/session';
import { can } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { CategoryManager } from '@/components/admin/category-manager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Categories' };

export default async function AdminCategoriesPage() {
  await requirePermission('categories.read');
  const user = await getCurrentUser();

  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    select: {
      id: true, slug: true, name: true, description: true, imageUrl: true,
      parentId: true, position: true, isActive: true, showInNav: true,
      metaTitle: true, metaDescription: true,
      _count: { select: { products: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl">Categories</h1>
        <p className="mt-1 text-sm text-muted">
          Collections shown on the storefront. Those marked “in nav” appear in the header menu.
        </p>
      </header>

      <CategoryManager
        categories={categories.map((c) => ({ ...c, productCount: c._count.products }))}
        canWrite={Boolean(user && can(user.role, 'categories.write'))}
      />
    </div>
  );
}
