'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { formatPaise } from '@/lib/money';

type Item = { id: string; sku: string; name: string; brand: string; variant: string; pricePaise: number; mrpPaise: number; available: number };
type CartLine = Item & { quantity: number };
type Quote = { fingerprint: string; subtotalPaise: number; couponDiscountPaise: number; manualDiscountPercent: number; manualDiscountPaise: number; roundOffPaise: number; grandTotalPaise: number };

export function OfflinePos() {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<Item[]>([]);
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [couponCode, setCouponCode] = React.useState('');
  const [manualDiscountPercent, setManualDiscountPercent] = React.useState('0');
  const [customerName, setCustomerName] = React.useState('');
  const [customerPhone, setCustomerPhone] = React.useState('');
  const [method, setMethod] = React.useState<'CASH' | 'CARD'>('CASH');
  const [busy, setBusy] = React.useState(false);
  const [quoting, setQuoting] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState('');
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [error, setError] = React.useState('');
  const [key, setKey] = React.useState(() => crypto.randomUUID());
  const scanRef = React.useRef<HTMLInputElement>(null);
  const subtotal = cart.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);
  const discountPercent = Number(manualDiscountPercent || 0);
  const normalizedPhone = customerPhone.replace(/\D/g, '').replace(/^91(?=[6-9]\d{9}$)/, '');
  const phoneValid = /^[6-9]\d{9}$/.test(normalizedPhone);
  const fingerprint = JSON.stringify({ cart: cart.map(({ id, quantity }) => [id, quantity]), couponCode: couponCode.trim(), discountPercent, normalizedPhone });
  const currentQuote = quote?.fingerprint === fingerprint ? quote : null;
  const makePayload = () => ({ idempotencyKey: key, items: cart.map(({ id, quantity }) => ({ variantId: id, quantity })),
    paymentMethod: method, customerName, customerPhone: normalizedPhone, couponCode, manualDiscountPercent: discountPercent });

  React.useEffect(() => {
    if (!cart.length || !Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      setQuote(null); setQuoting(false); return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setQuoting(true); setError('');
      try {
        const response = await fetch('/api/admin/offline-sales/quote', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify(makePayload()),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message ?? 'Unable to calculate total.');
        setQuote({ ...data, fingerprint });
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : 'Unable to calculate total.');
          setQuote(null);
        }
      } finally {
        if (!controller.signal.aborted) setQuoting(false);
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  // The fingerprint contains every field that changes the server total.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, cart.length]);

  async function search(value = query) {
    if (!value.trim()) return;
    setSearchError(''); setSearching(true);
    try {
      const response = await fetch(`/api/admin/offline-sales/lookup?q=${encodeURIComponent(value.trim())}`);
      const data = await response.json();
      if (!response.ok) { setSearchError(data.error?.message ?? 'Item not found.'); setResults([]); return; }
      const items = data.items as Item[];
      const exact = items.find((item) => item.id === value.trim() || item.sku.toLowerCase() === value.trim().toLowerCase());
      if (exact) { add(exact); setResults([]); setQuery(''); scanRef.current?.focus(); } else setResults(items);
    } catch { setSearchError('Search could not connect. Please try again.'); setResults([]); }
    finally { setSearching(false); }
  }

  function add(item: Item) {
    if (item.available < 1) { setError(`${item.name} is out of stock.`); return; }
    setCart((previous) => {
      const found = previous.find((line) => line.id === item.id);
      if (found) return previous.map((line) => line.id === item.id ? { ...line, quantity: Math.min(line.quantity + 1, item.available) } : line);
      return [...previous, { ...item, quantity: 1 }];
    });
  }

  async function complete() {
    if (!cart.length || busy) return;
    if (!phoneValid) { setError('Enter a valid 10 digit customer phone number.'); return; }
    if (!currentQuote) { setError('Please wait for the total to update.'); return; }
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/offline-sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...makePayload(), expectedGrandTotalPaise: currentQuote.grandTotalPaise }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? 'Unable to complete sale.');
      setCart([]); setCouponCode(''); setManualDiscountPercent('0'); setCustomerName(''); setCustomerPhone(''); setKey(crypto.randomUUID());
      router.push(`/admin/offline-sales/${data.id}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to complete sale.'); }
    finally { setBusy(false); scanRef.current?.focus(); }
  }

  return <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
    <section className="rounded-lg border border-line bg-white p-5">
      <h2 className="font-serif text-xl">Scan items</h2>
      <p className="mt-1 text-xs text-muted">Scan a barcode or search by product name or SKU.</p>
      <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); void search(); }}>
        <input ref={scanRef} autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Product name or SKU" className="min-w-0 flex-1 rounded border border-line px-3 py-2 text-sm" />
        <button disabled={searching} className="rounded bg-ink px-4 py-2 text-sm text-white disabled:opacity-50">{searching ? 'Finding…' : 'Find'}</button>
      </form>
      {searchError && <p role="alert" className="mt-2 rounded bg-red-50 p-2 text-sm text-danger">{searchError}</p>}
      {results.length > 0 && <div className="mt-3 max-h-64 overflow-y-auto rounded border border-line">
        {results.map((item) => <button key={item.id} type="button" onClick={() => { add(item); setResults([]); setQuery(''); scanRef.current?.focus(); }} className="flex w-full justify-between gap-2 border-b border-line p-3 text-left text-sm hover:bg-surface"><span><strong>{item.name}</strong><span className="block text-xs text-muted">{item.variant} · {item.sku} · {item.available} available</span></span><span>{formatPaise(item.pricePaise)}</span></button>)}
      </div>}
      <div className="mt-5 space-y-2">
        {cart.length === 0 && <p className="rounded border border-dashed border-line p-8 text-center text-sm text-muted">Scan or search for a product to start a sale.</p>}
        {cart.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-line p-3 text-sm"><div><strong>{item.name}</strong><p className="text-xs text-muted">{item.variant} · {item.sku} · {formatPaise(item.pricePaise)} each</p></div><div className="flex items-center gap-2"><input aria-label={`Quantity for ${item.name}`} type="number" min={1} max={item.available} value={item.quantity} onChange={(event) => setCart((old) => old.map((line) => line.id === item.id ? { ...line, quantity: Math.max(1, Math.min(item.available, Number(event.target.value) || 1)) } : line))} className="w-16 rounded border border-line p-2" /><strong>{formatPaise(item.pricePaise * item.quantity)}</strong><button type="button" className="text-danger underline" onClick={() => setCart((old) => old.filter((line) => line.id !== item.id))}>Remove</button></div></div>)}
      </div>
    </section>
    <section className="h-fit rounded-lg border border-line bg-white p-5">
      <h2 className="font-serif text-xl">Payment</h2>
      <div className="mt-4 grid gap-3 text-sm">
        <label>Customer name (optional)<input value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={150} className="mt-1 w-full rounded border border-line p-2" /></label>
        <label>Phone <span className="text-danger">*</span><input required inputMode="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} maxLength={14} placeholder="10 digit mobile number" className="mt-1 w-full rounded border border-line p-2" /></label>
        {customerPhone && !phoneValid && <p className="text-xs text-danger">Enter a valid 10 digit Indian mobile number.</p>}
        <label>Coupon code<input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} className="mt-1 w-full rounded border border-line p-2" placeholder="Optional" /></label>
        <label>Additional discount (%)<input type="text" inputMode="decimal" value={manualDiscountPercent} onChange={(e) => setManualDiscountPercent(e.target.value)} className="mt-1 w-full rounded border border-line p-2" /></label>
        <label>Payment method<select value={method} onChange={(e) => setMethod(e.target.value as 'CASH' | 'CARD')} className="mt-1 w-full rounded border border-line p-2"><option value="CASH">Cash received</option><option value="CARD">Card payment confirmed on terminal</option></select></label>
        <div className="border-t border-line pt-3"><div className="flex justify-between"><span>Subtotal</span><strong>{formatPaise(subtotal)}</strong></div><div className="mt-2 flex justify-between"><span>Coupon discount</span><span>-{formatPaise(currentQuote?.couponDiscountPaise ?? 0)}</span></div><div className="mt-2 flex justify-between"><span>Additional discount ({Number.isFinite(discountPercent) ? discountPercent : 0}%)</span><span>-{formatPaise(currentQuote?.manualDiscountPaise ?? 0)}</span></div>{currentQuote && <div className="mt-2 flex justify-between"><span>Round off</span><span>{formatPaise(currentQuote.roundOffPaise)}</span></div>}<div className="mt-3 flex justify-between border-t border-line pt-3 text-lg font-semibold"><span>Total due</span><span>{quoting ? 'Updating…' : currentQuote ? formatPaise(currentQuote.grandTotalPaise) : '—'}</span></div></div>
        {error && <p role="alert" className="rounded bg-red-50 p-2 text-danger">{error}</p>}
        <button type="button" disabled={!cart.length || busy || quoting || !currentQuote || !phoneValid} onClick={() => void complete()} className="rounded bg-ink p-3 font-semibold text-white disabled:opacity-50">{busy ? 'Completing…' : 'Payment received — complete sale'}</button>
      </div>
    </section>
  </div>;
}
