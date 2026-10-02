'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

export interface InventoryRow {
  id: string;
  sku: string;
  productId: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  reserved: number;
  lowStockThreshold: number;
}

/**
 * Variant-level stock editor.
 *
 * Each save posts an absolute quantity and the server records an
 * InventoryLedger entry, so every change has an actor and a reason.
 */
export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const save = async (row: InventoryRow) => {
    const raw = drafts[row.id];
    if (raw === undefined) return;
    const quantity = Number(raw);
    if (!Number.isFinite(quantity) || quantity < 0) {
      toast({ title: 'Enter a valid quantity.', variant: 'error' });
      return;
    }

    setSavingId(row.id);
    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId: row.id, quantity, note: 'Adjusted from inventory screen' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? 'Could not update stock.');

      toast({ title: `${row.productName} · ${row.variantLabel} set to ${quantity}`, variant: 'success' });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      router.refresh();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Update failed.', variant: 'error' });
    } finally {
      setSavingId(null);
    }
  };

  if (rows.length === 0) {
    return <p className="rounded-lg border border-line p-10 text-center text-sm text-muted">No variants match.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-line bg-surface/50 text-left">
          <tr className="text-2xs uppercase tracking-wide2 text-muted">
            <th className="p-3 font-medium">Product</th>
            <th className="p-3 font-medium">Variant</th>
            <th className="p-3 font-medium">SKU</th>
            <th className="p-3 font-medium">Reserved</th>
            <th className="p-3 font-medium">Available</th>
            <th className="p-3 font-medium">On hand</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => {
            const available = Math.max(0, row.quantity - row.reserved);
            const isLow = available <= row.lowStockThreshold;
            const dirty = drafts[row.id] !== undefined && Number(drafts[row.id]) !== row.quantity;

            return (
              <tr key={row.id} className={cn('transition-colors', isLow && 'bg-gold/[0.04]')}>
                <td className="p-3">
                  <Link href={`/admin/products/${row.productId}`} className="text-ink hover:underline">
                    {row.productName}
                  </Link>
                </td>
                <td className="p-3 text-muted">{row.variantLabel}</td>
                <td className="p-3 font-mono text-2xs text-faint">{row.sku}</td>
                <td className="p-3 tabular-nums text-muted">{row.reserved}</td>
                <td className={cn('p-3 font-medium tabular-nums', available === 0 ? 'text-danger' : isLow ? 'text-gold-ink' : 'text-ink')}>
                  {available}
                  {isLow && available > 0 && <span className="ml-1.5 text-2xs uppercase">low</span>}
                  {available === 0 && <span className="ml-1.5 text-2xs uppercase">out</span>}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      aria-label={`On-hand quantity for ${row.productName} ${row.variantLabel}`}
                      value={drafts[row.id] ?? String(row.quantity)}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && save(row)}
                      className="h-10 w-24"
                    />
                    {dirty && (
                      <button
                        type="button"
                        onClick={() => save(row)}
                        disabled={savingId === row.id}
                        aria-label="Save quantity"
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-ink text-bg disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
