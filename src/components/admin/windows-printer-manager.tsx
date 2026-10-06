'use client';

import * as React from 'react';
import { CheckCircle2, Download, Printer, RefreshCw } from 'lucide-react';
import {
  LABEL_PRINTER_KEY, RECEIPT_PRINTER_KEY, listWindowsPrinters, savePrinter, savedPrinter,
} from '@/lib/qz-print';

export function WindowsPrinterManager({ labelOnly = false }: { labelOnly?: boolean }) {
  const [printers, setPrinters] = React.useState<string[]>([]);
  const [labelPrinter, setLabelPrinter] = React.useState('');
  const [receiptPrinter, setReceiptPrinter] = React.useState('');
  const [status, setStatus] = React.useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    setLabelPrinter(savedPrinter(LABEL_PRINTER_KEY));
    setReceiptPrinter(savedPrinter(RECEIPT_PRINTER_KEY));
  }, []);

  async function refresh() {
    setStatus('connecting'); setMessage('');
    try {
      const found = await listWindowsPrinters();
      setPrinters(found);
      setStatus('connected');
      setMessage(found.length ? `${found.length} Windows printer${found.length === 1 ? '' : 's'} available.` : 'Windows returned no installed printers.');
    } catch {
      setStatus('error');
      setMessage('QZ Tray is not running. Install or open it on this Windows computer, then try again.');
    }
  }

  function choose(key: string, value: string) {
    if (key === LABEL_PRINTER_KEY) setLabelPrinter(value); else setReceiptPrinter(value);
    savePrinter(key, value);
  }

  return <section className="print-hide overflow-hidden rounded-lg border border-line bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
      <div><h2 className="flex items-center gap-2 font-serif text-lg"><Printer className="h-4 w-4" />Windows printers</h2><p className="mt-1 text-xs text-muted">Install QZ Tray once to show and print directly to printers installed on this computer.</p></div>
      <div className="flex gap-2"><a href="https://qz.io/download/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded border border-line px-3 py-2 text-xs"><Download className="h-3.5 w-3.5" />Install QZ Tray</a><button type="button" disabled={status === 'connecting'} onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded bg-ink px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${status === 'connecting' ? 'animate-spin' : ''}`} />{status === 'connecting' ? 'Connecting…' : printers.length ? 'Refresh printers' : 'Find printers'}</button></div>
    </div>
    <div className={`grid gap-4 p-4 ${labelOnly ? '' : 'md:grid-cols-2'}`}>
      <label className="text-sm"><span className="font-medium">Label printer</span><select value={labelPrinter} onChange={(event) => choose(LABEL_PRINTER_KEY, event.target.value)} disabled={!printers.length} className="mt-1 w-full rounded border border-line bg-white p-2 disabled:bg-surface"><option value="">{printers.length ? 'Select Shreyans P58D' : labelPrinter || 'Find printers first'}</option>{labelPrinter && !printers.includes(labelPrinter) && <option value={labelPrinter}>{labelPrinter} (saved)</option>}{printers.map((printer) => <option key={printer} value={printer}>{printer}</option>)}</select>{labelPrinter && <span className="mt-1 flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Selected: {labelPrinter}</span>}</label>
      {!labelOnly && <label className="text-sm"><span className="font-medium">Receipt printer</span><select value={receiptPrinter} onChange={(event) => choose(RECEIPT_PRINTER_KEY, event.target.value)} disabled={!printers.length} className="mt-1 w-full rounded border border-line bg-white p-2 disabled:bg-surface"><option value="">{printers.length ? 'Select TVS RP 3230' : receiptPrinter || 'Find printers first'}</option>{receiptPrinter && !printers.includes(receiptPrinter) && <option value={receiptPrinter}>{receiptPrinter} (saved)</option>}{printers.map((printer) => <option key={printer} value={printer}>{printer}</option>)}</select>{receiptPrinter && <span className="mt-1 flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Selected: {receiptPrinter}</span>}</label>}
    </div>
    {message && <p role="status" className={`border-t border-line px-4 py-3 text-xs ${status === 'error' ? 'bg-red-50 text-danger' : 'bg-surface/40 text-muted'}`}>{message}</p>}
    <p className="border-t border-line bg-surface/40 px-4 py-3 text-xs text-muted">When Chrome or QZ Tray asks for access, choose <strong className="text-ink">Allow</strong>. This permission is required to read and print to devices installed on this Windows computer.</p>
  </section>;
}
