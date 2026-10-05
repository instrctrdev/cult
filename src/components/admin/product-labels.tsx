'use client';

import * as React from 'react';
import JsBarcode from 'jsbarcode';
import { formatPaise } from '@/lib/money';

type LabelItem = { id: string; sku: string; name: string; brand: string; variant: string; mrpPaise: number };

export function ProductLabels({ items }: { items: LabelItem[] }) {
  const [selected, setSelected] = React.useState(items[0]?.id ?? '');
  const [count, setCount] = React.useState(1);
  const item = items.find((candidate) => candidate.id === selected);
  React.useEffect(() => {
    if (!item) return;
    document.querySelectorAll<SVGSVGElement>('.product-label-barcode').forEach((node) => {
      JsBarcode(node, /^[\x20-\x7e]+$/.test(item.sku) ? item.sku : item.id, { format: 'CODE128', width: 1.35, height: 38, margin: 0, displayValue: true, fontSize: 11 });
    });
  }, [item, count]);
  if (!item) return <p className="text-sm text-muted">Save a variant with a SKU to print labels.</p>;
  return <div className="space-y-4">
    <div className="print-hide flex flex-wrap gap-3"><label className="text-sm">Variant<select value={selected} onChange={(e) => setSelected(e.target.value)} className="ml-2 rounded border border-line p-2">{items.map((v) => <option key={v.id} value={v.id}>{v.sku} · {v.variant || v.name}</option>)}</select></label>
      <label className="text-sm">Copies<input type="number" min={1} max={200} value={count} onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} className="ml-2 w-20 rounded border border-line p-2" /></label>
      <button onClick={() => window.print()} className="rounded bg-ink px-4 py-2 text-sm text-white">Print labels</button></div>
    <p className="print-hide text-xs text-muted">Set the printer paper to 50 × 30 mm and print at 100% scale with margins and headers off. Choose the installed label printer in the print dialog.</p>
    <div className="label-sheet flex flex-wrap gap-2">{Array.from({ length: count }, (_, i) => <div key={i} className="product-label flex h-[30mm] w-[50mm] flex-col items-center justify-center overflow-hidden border border-line bg-white p-[2mm] text-center text-black">
      <strong className="max-w-full truncate text-[13px] uppercase">{item.brand}</strong><span className="max-w-full truncate text-[9px]">{item.name}{item.variant ? ` · ${item.variant}` : ''}</span><strong className="text-[12px]">MRP {formatPaise(item.mrpPaise)}</strong><svg className="product-label-barcode max-w-full" aria-label={`Barcode ${item.sku}`} /></div>)}</div>
    <style jsx global>{`@media print { @page { size: 50mm 30mm; margin: 0; } .admin-sidebar, .admin-panel > div > header, .print-hide { display:none!important; } .admin-panel > div, .admin-panel main { padding:0!important; margin:0!important; max-width:none!important; } .label-sheet { display:block!important; margin:0!important; } .product-label { break-after:page; border:0!important; margin:0!important; } .product-label:last-child { break-after:auto; } body { background:white!important; } }`}</style>
  </div>;
}
