import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePermission } from '@/lib/auth/session';
import { BulkImportForm } from '@/components/admin/bulk-import-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Bulk import products' };

export default async function BulkImportPage() {
  await requirePermission('products.write');

  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin/products" className="text-2xs uppercase tracking-wide2 text-muted hover:text-ink hover:underline">
          ← Products
        </Link>
        <h1 className="mt-1 font-serif text-2xl">Bulk import</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Add many products at once from a CSV and a ZIP of photos, instead of one at a time. Completely
          separate from the regular product form below — nothing here changes how single products are added.
        </p>
      </header>

      <BulkImportForm />
    </div>
  );
}
