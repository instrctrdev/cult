/**
 * Payment configuration check.
 *
 *   npm run check:payments
 *
 * Run this after putting gateway credentials in `.env`. It reports what the
 * app will actually do at checkout, and probes the real endpoint of whichever
 * provider `PAYMENT_PROVIDER` selects — so a wrong key or secret surfaces here
 * rather than on a customer's order. It never creates a payment or checkout
 * session; only read-only/lookup calls are made.
 */
import { createHmac } from 'crypto';
import './load-env';

const CHECK = '✓';
const CROSS = '✗';
const WARN = '!';

function line(status: string, label: string, detail = '') {
  console.log(`  ${status} ${label.padEnd(34)}${detail}`);
}

async function main() {
  console.log('\n▸ Payment configuration\n');

  const provider = process.env.PAYMENT_PROVIDER ?? 'manual';
  line(provider !== 'manual' ? CHECK : WARN, 'PAYMENT_PROVIDER', provider);

  if (provider === 'cashfree') return checkCashfree();
  if (provider === 'fastrr') return checkFastrr();

  console.log(`
  ${WARN} Prepaid is switched off.

    The app is on the manual provider: cash on delivery works, online payment is
    hidden at checkout, and no order is ever auto-marked as paid. Set
    PAYMENT_PROVIDER="cashfree" (recommended) or "fastrr" with credentials to
    enable prepaid.
`);
}

// ─────────────────────────────── Cashfree ──────────────────────────────────

async function checkCashfree() {
  const clientId = process.env.PAYMENT_API_KEY ?? '';
  const clientSecret = process.env.PAYMENT_SECRET ?? '';
  const baseUrl = (process.env.CASHFREE_BASE_URL ?? 'https://sandbox.cashfree.com/pg').replace(/\/$/, '');
  const apiVersion = process.env.CASHFREE_API_VERSION ?? '2023-08-01';

  line(clientId ? CHECK : CROSS, 'PAYMENT_API_KEY (x-client-id)', clientId ? `set (${clientId.length} chars)` : 'MISSING');
  line(clientSecret ? CHECK : CROSS, 'PAYMENT_SECRET (x-client-secret)', clientSecret ? `set (${clientSecret.length} chars)` : 'MISSING');
  line(CHECK, 'CASHFREE_BASE_URL', baseUrl);
  if (baseUrl.includes('sandbox')) line(WARN, 'environment', 'SANDBOX — switch to https://api.cashfree.com/pg for real orders');
  line(CHECK, 'CASHFREE_API_VERSION', apiVersion);

  if (!clientId || !clientSecret) {
    console.log(`
  ${CROSS} Credentials incomplete — the app will fall back to the manual
    provider, so prepaid stays hidden and COD keeps working.
`);
    process.exit(1);
  }

  // ── Checkout UI (npm package, not a URL to probe) ────────────────────────
  const mode = process.env.NEXT_PUBLIC_CASHFREE_MODE ?? 'sandbox';
  console.log('\n▸ Checkout UI\n');
  line(CHECK, '@cashfreepayments/cashfree-js', 'installed — loaded via import(), not a script URL');
  line(CHECK, 'NEXT_PUBLIC_CASHFREE_MODE', mode);
  const expectedMode = baseUrl.includes('sandbox') ? 'sandbox' : 'production';
  if (mode !== expectedMode) {
    line(WARN, 'mode mismatch', `NEXT_PUBLIC_CASHFREE_MODE="${mode}" but CASHFREE_BASE_URL points at ${expectedMode}`);
  }

  // ── Signed... actually unsigned (Cashfree uses plain header auth) ───────
  console.log('\n▸ Probing the API (no order is created)\n');

  const url = `${baseUrl}/orders/CONNECTIVITY-CHECK`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
        'x-api-version': apiVersion,
      },
      signal: AbortSignal.timeout(15_000),
    });
    const text = (await res.text()).slice(0, 400);

    if (res.status === 401) {
      line(CROSS, 'authentication', '401 — x-client-id / x-client-secret rejected');
      process.exit(1);
    }
    if (res.status === 404) {
      // A "no such order" for a fake id is exactly what a reachable,
      // authenticated endpoint should say — this is the success case.
      line(CHECK, 'reachable and authenticated', `HTTP 404 (order does not exist — expected for a fake id)`);
      console.log(`\n    Response: ${text || '(empty)'}\n`);
      console.log(`  ${CHECK} Cashfree looks correctly configured.

    Next: place one real ₹1 prepaid order end to end, complete it in
    Cashfree's checkout modal, and confirm /checkout/confirmation/[orderNumber]
    settles it to CONFIRMED. Also confirm the webhook: set the notify URL in
    your Cashfree dashboard to https://<your-domain>/api/webhooks/payment and
    check the event lands with signatureOk=true.
`);
      return;
    }

    line(res.ok ? CHECK : WARN, 'response', `HTTP ${res.status}`);
    console.log(`\n    Response: ${text || '(empty)'}\n`);
  } catch (err) {
    line(CROSS, 'connectivity', err instanceof Error ? err.message : 'failed');
    console.log(`\n    Could not reach ${baseUrl}. Check CASHFREE_BASE_URL and network access from this machine.\n`);
    process.exit(1);
  }
}

// ──────────────────────────────── Fastrr ───────────────────────────────────

async function checkFastrr() {
  const apiKey = process.env.PAYMENT_API_KEY ?? '';
  const secret = process.env.PAYMENT_SECRET ?? '';
  const baseUrl = (process.env.PAYMENT_BASE_URL ?? '').replace(/\/$/, '');
  const paths = {
    create: process.env.FASTRR_PATH_CREATE ?? '/api/v1/access-token/checkout',
    status: process.env.FASTRR_PATH_STATUS ?? '/api/v1/custom-platform-order/details',
    transactions: process.env.FASTRR_PATH_TRANSACTIONS ?? '/api/v1/custom-platform-order/details/transactions',
  };

  line(apiKey ? CHECK : CROSS, 'PAYMENT_API_KEY', apiKey ? `set (${apiKey.length} chars)` : 'MISSING');
  line(secret ? CHECK : CROSS, 'PAYMENT_SECRET', secret ? `set (${secret.length} chars)` : 'MISSING');
  line(baseUrl ? CHECK : CROSS, 'PAYMENT_BASE_URL', baseUrl || 'MISSING');
  if (baseUrl.includes('fastrr-api-dev')) line(WARN, 'environment', 'STAGING — switch to https://checkout-api.shiprocket.com for real orders');
  line(CHECK, 'checkout / details / transactions', `${paths.create}  ${paths.status}  ${paths.transactions}`);
  line(WARN, 'refunds', "not available — Fastrr's current API has no refund endpoint (confirmed against their spec)");

  if (!apiKey || !secret || !baseUrl) {
    console.log(`
  ${CROSS} Credentials incomplete — the app will fall back to the manual
    provider, so prepaid stays hidden and COD keeps working.
`);
    process.exit(1);
  }

  console.log('\n▸ Checkout UI bundle\n');
  const sdkUrl = process.env.NEXT_PUBLIC_FASTRR_SDK_URL ?? '';
  const cssUrl = process.env.NEXT_PUBLIC_FASTRR_SDK_CSS_URL ?? '';
  if (!sdkUrl) {
    line(WARN, 'NEXT_PUBLIC_FASTRR_SDK_URL', 'not set — widget skipped');
  } else {
    line(CHECK, 'NEXT_PUBLIC_FASTRR_SDK_URL', sdkUrl);
    line(cssUrl ? CHECK : WARN, 'NEXT_PUBLIC_FASTRR_SDK_CSS_URL', cssUrl || "not set — Fastrr's UI may be unstyled");
    try {
      const res = await fetch(sdkUrl, { signal: AbortSignal.timeout(15_000) });
      const body = res.ok ? await res.text() : '';
      const hasHeadless = /HeadlessCheckout/.test(body);
      line(res.ok ? CHECK : CROSS, 'bundle reachable', `HTTP ${res.status}`);
      line(hasHeadless ? CHECK : WARN, 'HeadlessCheckout.addToCart', hasHeadless ? 'found in bundle' : 'not detected');
    } catch (err) {
      line(CROSS, 'bundle reachable', err instanceof Error ? err.message : 'failed');
    }
  }

  console.log('\n▸ Signing a real request (no payment is created)\n');
  const url = `${baseUrl}${paths.status}`;
  const body = JSON.stringify({ order_id: 'CONNECTIVITY-CHECK', timestamp: new Date().toISOString() });
  const signature = createHmac('sha256', secret).update(body).digest('base64');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey, 'X-Api-HMAC-SHA256': signature },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    const text = (await res.text()).slice(0, 400);

    if (res.status === 404) {
      line(CROSS, 'endpoint', '404 — check PAYMENT_BASE_URL / FASTRR_PATH_STATUS');
      process.exit(1);
    }
    if (res.status === 401 || res.status === 403 || res.status === 511) {
      line(CROSS, 'authentication', `${res.status} — key/secret rejected, or the HMAC signing scheme differs`);
      process.exit(1);
    }

    line(CHECK, 'reachable and authenticated', `HTTP ${res.status}`);
    console.log(`\n    Response: ${text || '(empty)'}\n`);
  } catch (err) {
    line(CROSS, 'connectivity', err instanceof Error ? err.message : 'failed');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Check failed:', e);
  process.exit(1);
});
