import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { toPaise } from '@/lib/money';
import { ProductLabels } from '@/components/admin/product-labels';

export const dynamic = 'force-dynamic';

export default async function LabelsPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('products.read');
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, include: { variants: { where: { deletedAt: null }, include: { size: true, color: true, inventory: true } } } });
  if (!product || product.deletedAt) notFound();
  return <div className="space-y-5"><div className="print-hide"><Link href={`/admin/products/${id}`} className="text-sm underline">← Back to product</Link><h1 className="mt-3 font-serif text-2xl">Print product labels</h1><p className="mt-1 text-sm text-muted">Each barcode encodes its variant SKU for offline billing.</p></div>
    <ProductLabels
      emptyProduct={{ id: product.id, price: Number(product.price), compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null }}
      items={product.variants.map((v) => ({ id: v.id, sku: v.sku, name: product.name, brand: product.vendor, variant: [v.size?.label, v.color?.name].filter(Boolean).join(' / '), mrpPaise: toPaise(v.compareAtPrice && v.compareAtPrice.greaterThan(v.price) ? v.compareAtPrice : v.price), stock: v.inventory?.quantity ?? 0 }))}
    />
  </div>;
}
