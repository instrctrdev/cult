'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import JsBarcode from 'jsbarcode';
import { Barcode, Minus, Plus, Printer } from 'lucide-react';
import { formatPaise } from '@/lib/money';

type LabelItem = { id: string; sku: string; name: string; brand: string; variant: string; mrpPaise: number };
type EmptyProduct = { id: string; slug: string; price: number; compareAtPrice: number | null };

function barcodeValue(item: LabelItem) {
  return /^[\x20-\x7e]+$/.test(item.sku) ? item.sku : item.id;
}

function LabelPreview({ item }: { item: LabelItem }) {
  return <div className="product-label flex h-[30mm] w-[50mm] shrink-0 flex-col items-center justify-center overflow-hidden border border-line bg-white p-[2mm] text-center text-black shadow-sm print:shadow-none">
    <strong className="max-w-full truncate text-[13px] uppercase">{item.brand}</strong>
    <span className="max-w-full truncate text-[9px]">{item.name}{item.variant ? ` · ${item.variant}` : ''}</span>
    <strong className="text-[12px]">MRP {formatPaise(item.mrpPaise)}</strong>
    <svg className="product-label-barcode max-w-full" data-barcode={barcodeValue(item)} aria-label={`Barcode ${item.sku}`} />
  </div>;
}

export function ProductLabels({ items, emptyProduct }: { items: LabelItem[]; emptyProduct: EmptyProduct }) {
  const router = useRouter();
  const [counts, setCounts] = React.useState<Record<string, number>>(() => Object.fromEntries(items.map((item) => [item.id, 1])));
  const [sku, setSku] = React.useState(emptyProduct.slug.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100));
  const [stock, setStock] = React.useState(1);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState('');

  const labels = items.flatMap((item) => Array.from({ length: counts[item.id] ?? 0 }, (_, copy) => ({ item, copy })));
  const selectedVariants = items.filter((item) => (counts[item.id] ?? 0) > 0).length;

  React.useEffect(() => {
    setCounts((previous) => {
      const next = Object.fromEntries(items.map((item) => [item.id, previous[item.id] ?? 1]));
      const changed = Object.keys(next).length !== Object.keys(previous).length ||
        Object.entries(next).some(([id, count]) => previous[id] !== count);
      return changed ? next : previous;
    });
  }, [items]);

  React.useEffect(() => {
    document.querySelectorAll<SVGSVGElement>('.product-label-barcode').forEach((node) => {
      const value = node.dataset.barcode;
      if (value) JsBarcode(node, value, { format: 'CODE128', width: 1.35, height: 38, margin: 0, displayValue: true, fontSize: 11 });
    });
  }, [counts, items]);

  function setCount(id: string, value: number) {
    setCounts((previous) => ({ ...previous, [id]: Math.max(0, Math.min(200, value || 0)) }));
  }

  async function createDefaultVariant() {
    if (!sku.trim()) { setError('Enter a SKU for the barcode.'); return; }
    setCreating(true); setError('');
    try {
      const response = await fetch(`/api/admin/products/${emptyProduct.id}/variants`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variants: [{
          sizeId: null, colorId: null, sku: sku.trim(), price: emptyProduct.price,
          compareAtPrice: emptyProduct.compareAtPrice, quantity: stock,
          lowStockThreshold: 3, weightGrams: 300, isActive: true,
        }] }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error?.message ?? 'Could not create the variant.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the variant.');
    } finally { setCreating(false); }
  }

  if (!items.length) return <section className="max-w-2xl rounded-lg border border-gold/30 bg-white p-5">
    <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/10"><Barcode className="h-5 w-5" /></span><div><h2 className="font-serif text-lg">Create the first scannable variant</h2><p className="mt-1 text-sm text-muted">This product was saved without a SKU variant. Create a default variant now so its label can be printed and found in offline billing.</p></div></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm">Barcode SKU<input value={sku} onChange={(event) => setSku(event.target.value)} maxLength={100} className="mt-1 w-full rounded border border-line p-2 font-mono" /></label><label className="text-sm">Starting stock<input type="number" min={0} max={1000000} value={stock} onChange={(event) => setStock(Math.max(0, Number(event.target.value) || 0))} className="mt-1 w-full rounded border border-line p-2" /></label></div>
    {error && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-danger">{error}</p>}
    <button type="button" onClick={() => void createDefaultVariant()} disabled={creating} className="mt-4 rounded bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{creating ? 'Creating…' : 'Create variant & show label'}</button>
  </section>;

  return <div className="space-y-6">
    <section className="print-hide overflow-hidden rounded-lg border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4"><div><h2 className="font-serif text-lg">Labels by variant</h2><p className="mt-1 text-xs text-muted">Set zero to skip a variant. Maximum 200 copies per variant.</p></div><div className="flex gap-2"><button type="button" onClick={() => setCounts(Object.fromEntries(items.map((item) => [item.id, 0])))} className="rounded border border-line px-3 py-2 text-xs">Clear all</button><button type="button" onClick={() => setCounts(Object.fromEntries(items.map((item) => [item.id, 1])))} className="rounded border border-line px-3 py-2 text-xs">One each</button></div></div>
      <div className="divide-y divide-line">{items.map((item) => <div key={item.id} className="grid items-center gap-3 p-4 sm:grid-cols-[1fr_auto_auto]">
        <div><p className="font-medium">{item.variant || 'Default variant'}</p><p className="mt-0.5 text-xs text-muted"><span className="font-mono">{item.sku}</span> · MRP {formatPaise(item.mrpPaise)}</p></div>
        <div className="flex items-center rounded border border-line"><button type="button" aria-label={`Remove one ${item.variant || item.sku} label`} onClick={() => setCount(item.id, (counts[item.id] ?? 0) - 1)} className="grid h-9 w-9 place-items-center"><Minus className="h-3.5 w-3.5" /></button><input aria-label={`Copies for ${item.variant || item.sku}`} type="number" min={0} max={200} value={counts[item.id] ?? 0} onChange={(event) => setCount(item.id, Number(event.target.value))} className="h-9 w-16 border-x border-line text-center tabular-nums" /><button type="button" aria-label={`Add one ${item.variant || item.sku} label`} onClick={() => setCount(item.id, (counts[item.id] ?? 0) + 1)} className="grid h-9 w-9 place-items-center"><Plus className="h-3.5 w-3.5" /></button></div>
        <span className="w-20 text-right text-sm font-semibold tabular-nums">{counts[item.id] ?? 0} label{(counts[item.id] ?? 0) === 1 ? '' : 's'}</span>
      </div>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/40 p-4"><p className="text-sm"><strong>{labels.length}</strong> labels across <strong>{selectedVariants}</strong> of {items.length} variants</p><button type="button" disabled={!labels.length} onClick={() => window.print()} className="inline-flex items-center gap-2 rounded bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><Printer className="h-4 w-4" />Print {labels.length} labels</button></div>
    </section>

    <section><div className="print-hide mb-3"><h2 className="font-serif text-lg">Print preview</h2><p className="mt-1 text-xs text-muted">This is how every 50 × 30 mm label will print on the Shreyans P58D. Use 100% scale with margins and browser headers off.</p></div>
      {labels.length ? <div className="label-sheet flex flex-wrap gap-3 rounded-lg border border-dashed border-line bg-surface/40 p-4 print:block print:border-0 print:bg-white print:p-0">{labels.map(({ item, copy }) => <LabelPreview key={`${item.id}-${copy}`} item={item} />)}</div> : <p className="print-hide rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">Increase a variant count to preview its label.</p>}
    </section>
    <style jsx global>{`@media print { @page { size: 50mm 30mm; margin: 0; } .admin-sidebar, .admin-panel > div > header, .print-hide { display:none!important; } .admin-panel > div, .admin-panel main { padding:0!important; margin:0!important; max-width:none!important; } .label-sheet { display:block!important; margin:0!important; } .product-label { break-after:page; border:0!important; margin:0!important; } .product-label:last-child { break-after:auto; } body { background:white!important; } }`}</style>
  </div>;
}
