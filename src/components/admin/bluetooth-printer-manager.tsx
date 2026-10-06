'use client';

import * as React from 'react';
import { Bluetooth, CheckCircle2, RefreshCw } from 'lucide-react';
import {
  BLUETOOTH_PRINTER_EVENT, chooseBluetoothPrinter, permittedBluetoothPrinter, supportsBluetoothPrinting,
} from '@/lib/bluetooth-label-printer';

export function BluetoothPrinterManager() {
  const [supported, setSupported] = React.useState(true);
  const [connected, setConnected] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    const available = supportsBluetoothPrinting();
    setSupported(available);
    if (available) void permittedBluetoothPrinter().then((port) => setConnected(Boolean(port)));
    const update = () => setConnected(true);
    window.addEventListener(BLUETOOTH_PRINTER_EVENT, update);
    return () => window.removeEventListener(BLUETOOTH_PRINTER_EVENT, update);
  }, []);

  async function connect() {
    setBusy(true); setMessage('');
    try {
      await chooseBluetoothPrinter();
      setConnected(true); setMessage('P58D Bluetooth printer is ready for direct label printing.');
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'NotFoundError') setMessage('No Bluetooth printer was selected.');
      else setMessage(cause instanceof Error ? cause.message : 'Could not connect the Bluetooth printer.');
    } finally { setBusy(false); }
  }

  return <section className="print-hide overflow-hidden rounded-lg border border-line bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold/10"><Bluetooth className="h-4 w-4" /></span><div><h2 className="font-serif text-lg">P58D Bluetooth printer</h2><p className="mt-1 text-xs text-muted">Shows only paired Bluetooth Classic printers. No desktop printing app is required.</p>{connected && <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Bluetooth printer authorized</p>}</div></div>
      <button type="button" disabled={busy || !supported} onClick={() => void connect()} className="inline-flex items-center gap-2 rounded bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />{busy ? 'Opening Bluetooth…' : connected ? 'Change Bluetooth printer' : 'Connect Bluetooth printer'}</button>
    </div>
    {!supported && <p className="border-t border-line bg-red-50 px-4 py-3 text-xs text-danger">Open this HTTPS site in current Google Chrome on Windows. This browser does not support Bluetooth serial printing.</p>}
    {message && <p role="status" className="border-t border-line bg-surface/40 px-4 py-3 text-xs text-muted">{message}</p>}
    <p className="border-t border-line bg-surface/40 px-4 py-3 text-xs text-muted">Pair P58D in Windows Bluetooth settings first. Chrome will then show the paired Bluetooth printer when you press Connect.</p>
  </section>;
}
