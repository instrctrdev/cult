'use client';

import * as React from 'react';
import { Bluetooth, CheckCircle2, Plus, Radio, RefreshCw } from 'lucide-react';
import {
  BLUETOOTH_PRINTER_EVENT, authorizedBluetoothPrinters, chooseBluetoothPrinter,
  selectBluetoothPrinter, supportsBluetoothPrinting, type AuthorizedBluetoothPrinter,
} from '@/lib/bluetooth-label-printer';

export function BluetoothPrinterManager() {
  const [supported, setSupported] = React.useState(true);
  const [printers, setPrinters] = React.useState<AuthorizedBluetoothPrinter[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    const available = supportsBluetoothPrinting();
    setSupported(available);
    const refresh = () => { if (available) void authorizedBluetoothPrinters().then(setPrinters); };
    refresh();
    const update = () => refresh();
    window.addEventListener(BLUETOOTH_PRINTER_EVENT, update);
    navigator.serial?.addEventListener('connect', update);
    navigator.serial?.addEventListener('disconnect', update);
    return () => {
      window.removeEventListener(BLUETOOTH_PRINTER_EVENT, update);
      navigator.serial?.removeEventListener('connect', update);
      navigator.serial?.removeEventListener('disconnect', update);
    };
  }, []);

  async function refresh() {
    setBusy(true); setMessage('');
    try { setPrinters(await authorizedBluetoothPrinters()); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not refresh printers.'); }
    finally { setBusy(false); }
  }

  async function connect() {
    setBusy(true); setMessage('');
    try {
      await chooseBluetoothPrinter();
      setPrinters(await authorizedBluetoothPrinters());
      setMessage('Printer added. It is ready for direct label printing.');
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'NotFoundError') setMessage('No Bluetooth printer was selected.');
      else setMessage(cause instanceof Error ? cause.message : 'Could not connect the Bluetooth printer.');
    } finally { setBusy(false); }
  }

  return <section className="print-hide overflow-hidden rounded-lg border border-line bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold/10"><Bluetooth className="h-4 w-4" /></span><div><h2 className="font-serif text-lg">P58D Bluetooth printers</h2><p className="mt-1 text-xs text-muted">Authorized printers appear here. Adding a new printer opens Chrome’s secure device chooser.</p></div></div>
      <div className="flex gap-2"><button type="button" disabled={busy || !supported} onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded border border-line bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />Refresh</button><button type="button" disabled={busy || !supported} onClick={() => void connect()} className="inline-flex items-center gap-2 rounded bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"><Plus className="h-3.5 w-3.5" />Add printer</button></div>
    </div>
    {!supported && <p className="border-t border-line bg-red-50 px-4 py-3 text-xs text-danger">Open this HTTPS site in current Google Chrome on Windows. This browser does not support Bluetooth serial printing.</p>}
    {supported && <div className="border-t border-line p-4">
      {printers.length ? <ul className="space-y-2">{printers.map((printer) => <li key={printer.id}><button type="button" onClick={() => { selectBluetoothPrinter(printer.port); void refresh(); setMessage(`${printer.label} selected.`); }} className={`flex w-full items-center justify-between rounded border p-3 text-left ${printer.selected ? 'border-ink bg-surface/60' : 'border-line'}`}><span className="flex items-center gap-2"><Radio className="h-4 w-4" /><span><span className="block text-sm font-medium">{printer.label}</span><span className="block text-xs text-muted">Chrome does not expose the printer’s friendly Bluetooth name.</span></span></span><span className={`flex items-center gap-1 text-xs ${printer.connected === false ? 'text-danger' : 'text-emerald-700'}`}>{printer.connected === false ? 'Not available' : <><CheckCircle2 className="h-3.5 w-3.5" />{printer.selected ? 'Selected' : 'Available'}</>}</span></button></li>)}</ul> : <p className="rounded border border-dashed border-line p-4 text-center text-xs text-muted">No printer authorized for this browser yet. Pair the P58D in Windows, then click Add printer.</p>}
    </div>}
    {message && <p role="status" className="border-t border-line bg-surface/40 px-4 py-3 text-xs text-muted">{message}</p>}
    <p className="border-t border-line bg-surface/40 px-4 py-3 text-xs text-muted">Pair P58D in Windows Bluetooth settings first. For security, nearby devices can only be shown in Chrome’s chooser; after approval, they are listed and selectable here.</p>
  </section>;
}
