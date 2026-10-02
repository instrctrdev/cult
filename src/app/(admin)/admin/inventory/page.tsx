import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { InventoryTable } from '@/components/admin/inventory-table';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Inventory' };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; low?: string }>;
}) {
  await requirePermission('inventory.read');
  const sp = await searchParams;

  const variants = await prisma.productVariant.findMany({
    where: {
      deletedAt: null,
      product: { deletedAt: null, ...(sp.q ? { name: { contains: sp.q } } : {}) },
    },
    orderBy: [{ product: { name: 'asc' } }, { position: 'asc' }],
    take: 300,
    select: {
      id: true, sku: true,
      size: { select: { label: true } },
      color: { select: { name: true } },
      product: { select: { id: true, name: true } },
      inventory: { select: { quantity: true, reserved: true, lowStockThreshold: true } },
    },
  });

  const rows = variants
    .map((v) => ({
      id: v.id,
      sku: v.sku,
      productId: v.product.id,
      productName: v.product.name,
      variantLabel: [v.color?.name, v.size?.label].filter(Boolean).join(' / ') || 'One size',
      quantity: v.inventory?.quantity ?? 0,
      reserved: v.inventory?.reserved ?? 0,
      lowStockThreshold: v.inventory?.lowStockThreshold ?? 3,
    }))
    .filter((r) => (sp.low === '1' ? r.quantity - r.reserved <= r.lowStockThreshold : true));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl">Inventory</h1>
          <p className="mt-1 text-sm text-muted">
            Available = on hand − reserved. Reserved stock is held for orders awaiting payment.
          </p>
        </div>
        <Link
          href={sp.low === '1' ? '/admin/inventory' : '/admin/inventory?low=1'}
          className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
            sp.low === '1' ? 'bg-ink text-bg' : 'bg-surface text-muted hover:text-ink'
          }`}
        >
          {sp.low === '1' ? 'Showing low stock' : 'Show low stock only'}
        </Link>
      </header>

      <InventoryTable rows={rows} />
    </div>
  );
}
