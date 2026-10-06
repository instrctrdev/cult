'use client';

import * as React from 'react';
import { Printer } from 'lucide-react';
import {
  PRINTER_SELECTION_EVENT, RECEIPT_PRINTER_KEY, printReceiptHtml, savedPrinter,
} from '@/lib/qz-print';

export function ReceiptPrint() {
  const [printer, setPrinter] = React.useState('');
  const [printing, setPrinting] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setPrinter(savedPrinter(RECEIPT_PRINTER_KEY));
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; value: string }>).detail;
      if (detail?.key === RECEIPT_PRINTER_KEY) setPrinter(detail.value);
    };
    window.addEventListener(PRINTER_SELECTION_EVENT, update);
    return () => window.removeEventListener(PRINTER_SELECTION_EVENT, update);
  }, []);

  async function printDirectly() {
    const receipt = document.querySelector<HTMLElement>('.receipt-paper');
    if (!printer || !receipt) return;
    setPrinting(true); setError('');
    try {
      const clone = receipt.cloneNode(true) as HTMLElement;
      const originals = [receipt, ...Array.from(receipt.querySelectorAll<HTMLElement>('*'))];
      const clones = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))];
      const properties = ['display', 'width', 'margin', 'padding', 'font-family', 'font-size', 'font-weight', 'line-height', 'text-align', 'text-transform', 'color', 'background-color', 'border', 'border-top', 'border-bottom', 'border-left', 'border-right', 'border-style', 'border-width', 'border-color', 'white-space', 'overflow-wrap', 'word-break', 'justify-content', 'align-items', 'gap'];
      originals.forEach((element, index) => {
        const computed = window.getComputedStyle(element);
        properties.forEach((property) => clones[index]?.style.setProperty(property, computed.getPropertyValue(property)));
      });
      clone.style.setProperty('width', '74mm'); clone.style.setProperty('box-shadow', 'none');
      await printReceiptHtml(printer, clone.outerHTML);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not print the receipt.');
    } finally { setPrinting(false); }
  }

  return <><div className="print-hide flex flex-wrap items-center justify-end gap-2">{error && <span className="text-xs text-danger">{error}</span>}{printer && <button type="button" disabled={printing} onClick={() => void printDirectly()} className="inline-flex items-center gap-2 rounded bg-ink px-4 py-2 text-sm text-white disabled:opacity-50"><Printer className="h-4 w-4" />{printing ? 'Sending…' : `Print to ${printer}`}</button>}<button type="button" onClick={() => window.print()} className="rounded border border-line bg-white px-4 py-2 text-sm">Use Windows print dialog</button></div>
    <style jsx global>{`@media print { @page { margin: 3mm; } .admin-sidebar, .admin-panel > div > header, .print-hide { display:none!important; } .admin-panel > div { padding:0!important; } .admin-panel main { padding:0!important; max-width:none!important; } .receipt-paper { width:74mm!important; border:0!important; padding:0!important; margin:0!important; box-shadow:none!important; } body { background:white!important; } }`}</style>
  </>;
}
