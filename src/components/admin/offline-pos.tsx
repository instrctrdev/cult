'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { formatPaise } from '@/lib/money';

type Item = { id: string; sku: string; name: string; brand: string; variant: string; pricePaise: number; mrpPaise: number; available: number };
type CartLine = Item & { quantity: number };

export function OfflinePos() {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<Item[]>([]);
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [couponCode, setCouponCode] = React.useState('');
  const [manualDiscount, setManualDiscount] = React.useState('0');
  const [customerName, setCustomerName] = React.useState('');
  const [customerPhone, setCustomerPhone] = React.useState('');
  const [method, setMethod] = React.useState<'CASH' | 'CARD'>('CASH');
  const [busy, setBusy] = React.useState(false);
  const [quote, setQuote] = React.useState<{ fingerprint: string; subtotalPaise: number; couponDiscountPaise: number; manualDiscountPaise: number; roundOffPaise: number; grandTotalPaise: number } | null>(null);
  const [error, setError] = React.useState('');
  const [key, setKey] = React.useState(() => crypto.randomUUID());
  const scanRef = React.useRef<HTMLInputElement>(null);
  const subtotal = cart.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);
  const manualPaise = Math.round(Number(manualDiscount || 0) * 100);
  const fingerprint = JSON.stringify({ cart: cart.map(({ id, quantity }) => [id, quantity]), couponCode, manualPaise, customerPhone });
  const currentQuote = quote?.fingerprint === fingerprint ? quote : null;
  const payload = () => ({ idempotencyKey: key, items: cart.map(({ id, quantity }) => ({ variantId: id, quantity })),
    paymentMethod: method, customerName, customerPhone, couponCode, manualDiscountPaise: manualPaise });

  async function search(value = query) {
    if (!value.trim()) return;
    setError('');
    const response = await fetch(`/api/admin/offline-sales/lookup?q=${encodeURIComponent(value.trim())}`);
    const data = await response.json();
    if (!response.ok) { setError(data.error?.message ?? 'Item not found.'); setResults([]); return; }
    const items = data.items as Item[];
    const exact = items.find((item) => item.id === value.trim() || item.sku.toLowerCase() === value.trim().toLowerCase());
    if (exact) { add(exact); setResults([]); setQuery(''); scanRef.current?.focus(); }
    else setResults(items);
  }

  function add(item: Item) {
    if (item.available < 1) { setError(`${item.name} is out of stock.`); return; }
    setCart((previous) => {
      const found = previous.find((line) => line.id === item.id);
      if (found) return previous.map((line) => line.id === item.id ? { ...line, quantity: Math.min(line.quantity + 1, item.available) } : line);
      return [...previous, { ...item, quantity: 1 }];
    });
  }

  async function checkTotal() {
    if (!cart.length || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/offline-sales/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? 'Unable to calculate total.');
      setQuote({ ...data, fingerprint });
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to calculate total.'); setQuote(null); }
    finally { setBusy(false); }
  }

  async function complete() {
    if (!cart.length || busy) return;
    if (!currentQuote) { setError('Review the current total before completing the sale.'); return; }
    if (!Number.isFinite(manualPaise) || manualPaise < 0 || manualPaise > subtotal) { setError('Enter a valid discount up to the subtotal.'); return; }
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/offline-sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload(), expectedGrandTotalPaise: currentQuote.grandTotalPaise }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? 'Unable to complete sale.');
      setCart([]); setCouponCode(''); setManualDiscount('0'); setCustomerName(''); setCustomerPhone(''); setKey(crypto.randomUUID());
      router.push(`/admin/offline-sales/${data.id}/receipt`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to complete sale.'); }
    finally { setBusy(false); scanRef.current?.focus(); }
  }

  return <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
    <section className="rounded-lg border border-line bg-white p-5">
      <h2 className="font-serif text-xl">Scan items</h2>
      <p className="mt-1 text-xs text-muted">Use a USB or Bluetooth scanner in keyboard mode, or search by SKU or name.</p>
      <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); void search(); }}>
        <input ref={scanRef} autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Scan barcode or enter SKU" className="min-w-0 flex-1 rounded border border-line px-3 py-2 text-sm" />
        <button className="rounded bg-ink px-4 py-2 text-sm text-white">Find</button>
      </form>
      {results.length > 0 && <div className="mt-3 max-h-64 overflow-y-auto rounded border border-line">
        {results.map((item) => <button key={item.id} type="button" onClick={() => { add(item); setResults([]); setQuery(''); scanRef.current?.focus(); }} className="flex w-full justify-between gap-2 border-b border-line p-3 text-left text-sm hover:bg-surface">
          <span><strong>{item.name}</strong><span className="block text-xs text-muted">{item.variant} · {item.sku} · {item.available} available</span></span><span>{formatPaise(item.pricePaise)}</span>
        </button>)}
      </div>}
      <div className="mt-5 space-y-2">
        {cart.length === 0 && <p className="rounded border border-dashed border-line p-8 text-center text-sm text-muted">Scan a product to start a sale.</p>}
        {cart.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-line p-3 text-sm">
          <div><strong>{item.name}</strong><p className="text-xs text-muted">{item.variant} · {item.sku} · {formatPaise(item.pricePaise)} each</p></div>
          <div className="flex items-center gap-2"><input aria-label={`Quantity for ${item.name}`} type="number" min={1} max={item.available} value={item.quantity} onChange={(event) => setCart((old) => old.map((line) => line.id === item.id ? { ...line, quantity: Math.max(1, Math.min(item.available, Number(event.target.value) || 1)) } : line))} className="w-16 rounded border border-line p-2" />
            <strong>{formatPaise(item.pricePaise * item.quantity)}</strong><button type="button" className="text-danger underline" onClick={() => setCart((old) => old.filter((line) => line.id !== item.id))}>Remove</button></div>
        </div>)}
      </div>
    </section>
    <section className="h-fit rounded-lg border border-line bg-white p-5">
      <h2 className="font-serif text-xl">Payment</h2>
      <div className="mt-4 grid gap-3 text-sm">
        <label>Customer name (optional)<input value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={150} className="mt-1 w-full rounded border border-line p-2" /></label>
        <label>Phone (optional)<input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} maxLength={32} className="mt-1 w-full rounded border border-line p-2" /></label>
        <label>Coupon code<input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} className="mt-1 w-full rounded border border-line p-2" placeholder="Optional" /></label>
        <label>Additional discount (Rs.)<input type="number" min="0" step="0.01" value={manualDiscount} onChange={(e) => setManualDiscount(e.target.value)} className="mt-1 w-full rounded border border-line p-2" /></label>
        <label>Payment method<select value={method} onChange={(e) => setMethod(e.target.value as 'CASH' | 'CARD')} className="mt-1 w-full rounded border border-line p-2"><option value="CASH">Cash received</option><option value="CARD">Card payment confirmed on terminal</option></select></label>
        <div className="border-t border-line pt-3"><div className="flex justify-between"><span>Subtotal</span><strong>{formatPaise(subtotal)}</strong></div><div className="mt-2 flex justify-between"><span>Coupon discount</span><span>-{formatPaise(currentQuote?.couponDiscountPaise ?? 0)}</span></div><div className="mt-2 flex justify-between"><span>Additional discount</span><span>-{formatPaise(Number.isFinite(manualPaise) ? manualPaise : 0)}</span></div>{currentQuote && <div className="mt-2 flex justify-between"><span>Round off</span><span>{formatPaise(currentQuote.roundOffPaise)}</span></div>}<div className="mt-3 flex justify-between border-t border-line pt-3 text-lg font-semibold"><span>Total due</span><span>{currentQuote ? formatPaise(currentQuote.grandTotalPaise) : 'Calculate total'}</span></div></div>
        {error && <p role="alert" className="rounded bg-red-50 p-2 text-danger">{error}</p>}
        <button type="button" disabled={!cart.length || busy} onClick={() => void checkTotal()} className="rounded border border-ink p-3 font-semibold disabled:opacity-50">Calculate total</button>
        <button type="button" disabled={!cart.length || busy || !currentQuote} onClick={() => void complete()} className="rounded bg-ink p-3 font-semibold text-white disabled:opacity-50">{busy ? 'Completing…' : 'Payment received — complete sale'}</button>
      </div>
    </section>
  </div>;
}
