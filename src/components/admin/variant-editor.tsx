'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export interface VariantRow {
  id?: string;
  sizeId: string | null;
  colorId: string | null;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  quantity: number;
  lowStockThreshold: number;
  weightGrams: number;
  isActive: boolean;
}

/**
 * Size/colour variant grid with per-variant stock.
 *
 * Saved through its own endpoint so a stock edit does not require re-saving
 * the product. Quantity here only seeds a brand-new variant — existing stock
 * is changed on the Inventory screen, which records a ledger entry.
 */
export function VariantEditor({
  productId,
  initial,
  sizes,
  colors,
}: {
  productId: string;
  initial: VariantRow[];
  sizes: { id: string; code: string; label: string }[];
  colors: { id: string; name: string; hex: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = React.useState<VariantRow[]>(initial);
  const [saving, setSaving] = React.useState(false);

  const update = (index: number, patch: Partial<VariantRow>) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const addRow = () => {
    const used = new Set(rows.map((r) => r.sizeId));
    const nextSize = sizes.find((s) => !used.has(s.id)) ?? sizes[0];
    setRows((prev) => [
      ...prev,
      {
        sizeId: nextSize?.id ?? null,
        colorId: prev[0]?.colorId ?? null,
        sku: '',
        price: prev[0]?.price ?? 0,
        compareAtPrice: prev[0]?.compareAtPrice ?? null,
        quantity: 0,
        lowStockThreshold: 3,
        weightGrams: prev[0]?.weightGrams ?? 300,
        isActive: true,
      },
    ]);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variants: rows }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? 'Could not save variants.');

      toast({ title: 'Variants saved', variant: 'success' });
      router.refresh();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Save failed.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border border-line">
      <div className="flex items-center justify-between gap-3 border-b border-line p-5">
        <div>
          <h2 className="font-serif text-lg">Variants &amp; stock</h2>
          <p className="mt-0.5 text-xs text-muted">
            Every buyable size/colour combination. Stock changes on existing variants belong on the
            Inventory screen.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted">
          No variants yet — add at least one so the product can be bought.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-line bg-surface/40 text-left">
              <tr className="text-2xs uppercase tracking-wide2 text-muted">
                <th className="p-2.5 font-medium">Size</th>
                <th className="p-2.5 font-medium">Colour</th>
                <th className="p-2.5 font-medium">SKU</th>
                <th className="p-2.5 font-medium">Price Rs.</th>
                <th className="p-2.5 font-medium">Compare Rs.</th>
                <th className="p-2.5 font-medium">Stock</th>
                <th className="p-2.5 font-medium">Low at</th>
                <th className="p-2.5 font-medium">Active</th>
                <th className="p-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row, i) => (
                <tr key={row.id ?? `new-${i}`}>
                  <td className="p-2">
                    <select
                      aria-label="Size"
                      value={row.sizeId ?? ''}
                      onChange={(e) => update(i, { sizeId: e.target.value || null })}
                      className="h-10 w-20 rounded-md border border-ink/15 bg-bg px-2"
                    >
                      <option value="">—</option>
                      {sizes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="p-2">
                    <select
                      aria-label="Colour"
                      value={row.colorId ?? ''}
                      onChange={(e) => update(i, { colorId: e.target.value || null })}
                      className="h-10 w-28 rounded-md border border-ink/15 bg-bg px-2"
                    >
                      <option value="">—</option>
                      {colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td className="p-2">
                    <Input
                      aria-label="SKU"
                      value={row.sku}
                      onChange={(e) => update(i, { sku: e.target.value })}
                      className="h-10 w-40 font-mono text-xs"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      aria-label="Price" type="number" step="0.01" min="0" value={row.price}
                      onChange={(e) => update(i, { price: Number(e.target.value) })}
                      className="h-10 w-24"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      aria-label="Compare at price" type="number" step="0.01" min="0"
                      value={row.compareAtPrice ?? ''}
                      onChange={(e) => update(i, { compareAtPrice: e.target.value ? Number(e.target.value) : null })}
                      className="h-10 w-24"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      aria-label="Stock quantity" type="number" min="0" value={row.quantity}
                      onChange={(e) => update(i, { quantity: Number(e.target.value) })}
                      disabled={Boolean(row.id)}
                      title={row.id ? 'Adjust existing stock on the Inventory screen' : undefined}
                      className="h-10 w-20"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      aria-label="Low stock threshold" type="number" min="0" value={row.lowStockThreshold}
                      onChange={(e) => update(i, { lowStockThreshold: Number(e.target.value) })}
                      className="h-10 w-20"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <input
                      type="checkbox" aria-label="Active" className="h-4 w-4 accent-ink"
                      checked={row.isActive}
                      onChange={(e) => update(i, { isActive: e.target.checked })}
                    />
                  </td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label="Remove variant"
                      className="grid h-8 w-8 place-items-center rounded text-faint hover:bg-surface hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-line p-4">
        <Button onClick={save} loading={saving} disabled={rows.length === 0}>
          Save variants
        </Button>
      </div>
    </section>
  );
}
