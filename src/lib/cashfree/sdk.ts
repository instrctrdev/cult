'use client';

import { publicEnv } from '@/lib/env';

/**
 * Cashfree checkout — browser side.
 *
 * Uses Cashfree's own `@cashfreepayments/cashfree-js` npm package rather than
 * a hand-rolled script-tag loader (the approach Fastrr's integration needed,
 * since Fastrr has no published SDK package). The flow:
 *
 *   1. Server calls `POST /orders` and gets back a `payment_session_id`
 *      (see `src/services/payment/cashfree.provider.ts`).
 *   2. Browser loads the SDK and calls `cashfree.checkout({ paymentSessionId })`
 *      — Cashfree owns the UI from here, in an in-page modal.
 *   3. On completion the browser is returned to `returnUrl`.
 *
 * That return is a UX courtesy only — nothing is settled by it. The
 * confirmation page always re-verifies server-side
 * (`PaymentService.verifyAndSettle`), which is the only thing that can mark
 * an order paid, exactly as it does for every other provider in this app.
 */

interface CashfreeInstance {
  checkout: (options: {
    paymentSessionId: string;
    redirectTarget?: '_self' | '_modal' | '_blank';
  }) => Promise<{ error?: { message?: string }; redirect?: boolean } | void>;
}

let loader: Promise<CashfreeInstance> | null = null;

/** Loads and initialises the SDK once per page, in the configured mode. */
function loadSdk(): Promise<CashfreeInstance> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Cashfree can only load in the browser.'));
  if (loader) return loader;

  loader = import('@cashfreepayments/cashfree-js')
    .then(({ load }) => load({ mode: publicEnv.NEXT_PUBLIC_CASHFREE_MODE }))
    .catch((err) => {
      loader = null; // allow a retry on the next attempt
      throw err;
    });

  return loader;
}

/** Warms the Cashfree SDK chunk before the customer taps Pay. */
export function preloadCashfreeCheckout(): void {
  if (typeof window === 'undefined' || !isCashfreeSdkConfigured()) return;
  void loadSdk().catch(() => undefined);
}

export interface CashfreeResult {
  opened: boolean;
  reason?: string;
}

/**
 * Opens Cashfree's checkout modal for an already-created session.
 *
 * @param paymentSessionId  The `payment_session_id` returned by our server's
 *                          `POST /api/payments/create` (in `clientConfig`).
 */
export async function openCashfreeCheckout(paymentSessionId: string): Promise<CashfreeResult> {
  if (!paymentSessionId) return { opened: false, reason: 'No checkout session was provided.' };

  let cashfree: CashfreeInstance;
  try {
    cashfree = await loadSdk();
  } catch (err) {
    return { opened: false, reason: err instanceof Error ? err.message : 'Cashfree unavailable.' };
  }

  try {
    // Modal keeps the customer on our page — closest equivalent to the
    // "single-click, in-page" experience the brief asked for.
    const result = await cashfree.checkout({ paymentSessionId, redirectTarget: '_modal' });
    if (result?.error) {
      return { opened: false, reason: result.error.message ?? 'Cashfree checkout failed to open.' };
    }
    return { opened: true };
  } catch (err) {
    return { opened: false, reason: err instanceof Error ? err.message : 'Cashfree refused the session.' };
  }
}

/** True when enough is configured to attempt the widget at all. */
export function isCashfreeSdkConfigured(): boolean {
  return publicEnv.NEXT_PUBLIC_PAYMENT_PROVIDER === 'cashfree';
}
