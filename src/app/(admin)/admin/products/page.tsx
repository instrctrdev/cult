import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Plus, AlertTriangle } from 'lucide-react';
import { Prisma, ProductStatus } from '@prisma/client';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { formatPaise } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { AdminFilterBar } from '@/components/admin/admin-filter-bar';
import { cn } from '@/lib/utils';
import { DeletedProductActions } from '@/components/admin/deleted-product-actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Products' };

const PER_PAGE = 25;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; needsAttention?: string; deleted?: string }>;
}) {
  await requirePermission('products.read');
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  // Deleted products are hidden everywhere else, so they need a view of their
  // own — otherwise a mis-click is unrecoverable and looks like data loss.
  const showDeleted = sp.deleted === '1';

  const where: Prisma.ProductWhereInput = {
    deletedAt: showDeleted ? { not: null } : null,
    ...(sp.status && sp.status in ProductStatus ? { status: sp.status as ProductStatus } : {}),
    ...(sp.needsAttention === '1' ? { OR: [{ needsImagery: true }, { needsDescription: true }] } : {}),
    ...(sp.q ? { name: { contains: sp.q } } : {}),
  };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true, name: true, slug: true, status: true, price: true, compareAtPrice: true,
        needsImagery: true, needsDescription: true,
        images: { orderBy: { position: 'asc' }, take: 1, select: { url: true, isPlaceholder: true } },
        categories: { select: { category: { select: { name: true } } } },
        variants: {
          where: { deletedAt: null },
          select: { id: true, inventory: { select: { quantity: true, reserved: true } } },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl">Products</h1>
          <p className="mt-1 text-sm text-muted">{total} product{total === 1 ? '' : 's'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/products/import">Bulk import</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus className="h-4 w-4" aria-hidden />
              New product
            </Link>
          </Button>
        </div>
      </header>

      <AdminFilterBar
        basePath="/admin/products"
        searchPlaceholder="Search by product name"
        filters={[
          { label: 'All', param: {} },
          { label: 'Active', param: { status: 'ACTIVE' } },
          { label: 'Draft', param: { status: 'DRAFT' } },
          { label: 'Archived', param: { status: 'ARCHIVED' } },
          { label: 'Needs attention', param: { needsAttention: '1' } },
          { label: 'Deleted', param: { deleted: '1' } },
        ]}
      />

      {showDeleted && products.length > 0 && (
        <p className="rounded-lg border border-line bg-surface p-4 text-sm text-muted">
          These are hidden from the store and from every other tab. Restore brings one back as a
          draft. Erase removes it for good, and is refused for anything a customer has ordered.
        </p>
      )}

      {products.length === 0 ? (
        <p className="rounded-lg border border-line p-10 text-center text-sm text-muted">
          {showDeleted ? 'Nothing has been deleted.' : 'No products match this view.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-line bg-surface/50 text-left">
              <tr className="text-2xs uppercase tracking-wide2 text-muted">
                <th className="p-3 font-medium">Product</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Collections</th>
                <th className="p-3 font-medium">Stock</th>
                <th className="p-3 text-right font-medium">Price</th>
                {showDeleted && <th className="p-3 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.map((product) => {
                const stock = product.variants.reduce(
                  (sum, v) => sum + Math.max(0, (v.inventory?.quantity ?? 0) - (v.inventory?.reserved ?? 0)),
                  0,
                );
                const image = product.images[0];
                const needsWork = product.needsImagery || product.needsDescription;

                return (
                  <tr key={product.id} className="transition-colors hover:bg-surface/40">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded bg-surface">
                          {image && !image.isPlaceholder ? (
                            <Image src={image.url} alt="" fill sizes="44px" className="object-cover" />
                          ) : (
                            <span className="grid h-full place-items-center text-[9px] uppercase text-faint">None</span>
                          )}
                        </span>
                        <span className="min-w-0">
                          <Link href={`/admin/products/${product.id}`} className="block font-medium text-ink hover:underline">
                            {product.name}
                          </Link>
                          <span className="block text-2xs text-faint">/{product.slug}</span>
                          {needsWork && (
                            <span className="mt-1 inline-flex items-center gap-1 text-2xs text-gold-ink">
                              <AlertTriangle className="h-3 w-3" aria-hidden />
                              {[product.needsImagery && 'imagery', product.needsDescription && 'description']
                                .filter(Boolean)
                                .join(' + ')}{' '}
                              needed
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-1 text-2xs font-semibold uppercase tracking-wide2',
                          product.status === 'ACTIVE' && 'bg-success/10 text-success',
                          product.status === 'DRAFT' && 'bg-gold/10 text-gold-ink',
                          product.status === 'ARCHIVED' && 'bg-ink/[0.06] text-muted',
                        )}
                      >
                        {product.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted">
                      {product.categories.map((c) => c.category.name).slice(0, 2).join(', ') || '—'}
                    </td>
                    <td className={cn('p-3 tabular-nums', stock === 0 ? 'text-danger' : 'text-ink')}>
                      {stock}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {formatPaise(Number(product.price) * 100)}
                      {product.compareAtPrice && (
                        <span className="block text-2xs text-faint line-through">
                          {formatPaise(Number(product.compareAtPrice) * 100)}
                        </span>
                      )}
                    </td>
                    {showDeleted && (
                      <td className="p-3">
                        <DeletedProductActions id={product.id} name={product.name} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex justify-center gap-2">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((n) => {
            const params = new URLSearchParams(sp as Record<string, string>);
            params.set('page', String(n));
            return (
              <Link
                key={n}
                href={`/admin/products?${params.toString()}`}
                aria-current={n === page ? 'page' : undefined}
                className={`grid h-9 w-9 place-items-center rounded-md text-sm ${
                  n === page ? 'bg-ink text-bg' : 'border border-line text-muted hover:border-ink hover:text-ink'
                }`}
              >
                {n}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
