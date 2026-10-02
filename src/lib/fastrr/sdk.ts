'use client';

import { publicEnv } from '@/lib/env';

/**
 * Fastrr headless checkout — browser side.
 *
 * Confirmed directly with Shiprocket support via their "Full checkout custom
 * Integration APIs [PUBLIC]" Postman collection ("Checkout UI Flow" section).
 * The flow is:
 *
 *   1. Server calls POST /api/v1/access-token/checkout with the cart and gets
 *      back a short-lived `token` (see `src/services/payment/fastrr.provider.ts`).
 *   2. Browser loads Fastrr's checkout bundle + stylesheet.
 *   3. Browser calls `HeadlessCheckout.addToCart(event, token)` — Fastrr owns
 *      the UI from here (address, payment, COD) inside the page.
 *   4. On completion the browser is redirected to
 *      `<our returnUrl>?oid=<fastrr_order_id>&ost=SUCCESS|FAILED`.
 *
 * That redirect is a UX courtesy only — nothing is settled by it. The
 * confirmation page (`?oid=…&ost=…`) triggers a server-side
 * `PaymentService.verifyAndSettle`, which is the only thing that can mark an
 * order paid, exactly as it would for a manual reload.
 *
 * The bundle URL is the same for every platform Fastrr supports — Shopify,
 * WooCommerce, custom — the platform-specific behaviour lives entirely in
 * which entry point you call and what you pass it, not in a different file.
 */

const SCRIPT_ID = 'fastrr-checkout-sdk';
const STYLE_ID = 'fastrr-checkout-css';
let loader: Promise<FastrrGlobals> | null = null;

interface FastrrGlobals {
  HeadlessCheckout?: {
    addToCart?: (event: Event | undefined, token: string) => void;
  };
}

/** Loads the bundle + stylesheet once and resolves when the global appears. */
function loadSdk(timeoutMs = 12_000): Promise<FastrrGlobals> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Fastrr can only load in the browser.'));
  if (loader) return loader;

  const scriptSrc = publicEnv.NEXT_PUBLIC_FASTRR_SDK_URL;
  const styleSrc = publicEnv.NEXT_PUBLIC_FASTRR_SDK_CSS_URL;
  if (!scriptSrc) return Promise.reject(new Error('NEXT_PUBLIC_FASTRR_SDK_URL is not set.'));

  if (styleSrc && !document.getElementById(STYLE_ID)) {
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = styleSrc;
    document.head.appendChild(link);
  }

  loader = new Promise<FastrrGlobals>((resolve, reject) => {
    const w = window as unknown as FastrrGlobals;
    const ready = () => Boolean(w.HeadlessCheckout?.addToCart);

    if (ready()) return resolve(w);

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(timer);
      fn();
    };

    // The bundle attaches its global after executing, so the script's own
    // load event alone is not a reliable readiness signal.
    const poll = setInterval(() => {
      if (ready()) finish(() => resolve(w));
    }, 120);

    const timer = setTimeout(
      () =>
        finish(() => {
          loader = null; // allow a retry on the next attempt
          reject(new Error('Fastrr checkout did not initialise in time.'));
        }),
      timeoutMs,
    );

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = scriptSrc;
      script.async = true;
      script.addEventListener('error', () =>
        finish(() => {
          loader = null;
          reject(new Error('Fastrr checkout script could not be loaded.'));
        }),
      );
      document.head.appendChild(script);
    }
  });

  return loader;
}

export interface FastrrResult {
  opened: boolean;
  reason?: string;
}

/**
 * Opens Fastrr's checkout UI in-page for an already-created session.
 *
 * @param token  The `token` returned by our server's
 *               `POST /api/payments/create` (in `clientConfig.token`).
 * @param event  The triggering click event, if there is one — Fastrr's
 *               `addToCart` accepts and forwards it; it is optional.
 */
export async function openFastrrCheckout(token: string, event?: Event): Promise<FastrrResult> {
  if (!token) return { opened: false, reason: 'No checkout token was provided.' };

  let sdk: FastrrGlobals;
  try {
    sdk = await loadSdk();
  } catch (err) {
    return { opened: false, reason: err instanceof Error ? err.message : 'Fastrr unavailable.' };
  }

  const addToCart = sdk.HeadlessCheckout?.addToCart;
  if (!addToCart) {
    return { opened: false, reason: 'Fastrr loaded but exposed no checkout entry point.' };
  }

  try {
    addToCart(event, token);
    return { opened: true };
  } catch (err) {
    return { opened: false, reason: err instanceof Error ? err.message : 'Fastrr refused the token.' };
  }
}

/** True when enough is configured to attempt the widget at all. */
export function isFastrrSdkConfigured(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_FASTRR_SDK_URL);
}
