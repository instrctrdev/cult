'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
import { openCashfreeCheckout } from '@/lib/cashfree/sdk';
import { browserUuid } from '@/lib/browser/uuid';

/**
 * Releases the order when the page itself is going away.
 *
 * The in-page release below only runs if the customer is still on the page
 * when the sheet closes. Pressing the browser's back button, switching apps
 * or closing the tab kills the script first — which is exactly how an
 * abandoned checkout was still leaving a PENDING order holding stock.
 * `sendBeacon` is the one request the browser guarantees to deliver during
 * unload; a normal fetch is cancelled.
 *
 * Safe to fire even when the payment succeeded: the endpoint asks the
 * gateway and only cancels an order that was genuinely never paid.
 */
function beaconRelease(reference: string): void {
  if (typeof navigator === 'undefined' || !navigator.sendBeacon || !reference) return;
  try {
    navigator.sendBeacon(
      '/api/checkout/express/release',
      new Blob([JSON.stringify({ reference })], { type: 'application/json' }),
    );
  } catch {
    // Nothing useful to do while the page is being torn down.
  }
}

/**
 * Asks the server what actually happened once the sheet closed. A failure
 * here reports "paid" so the customer is still sent to the confirmation
 * page, which re-verifies server-side — far better than telling someone who
 * just paid that their order was not placed.
 */
async function releaseOrSettle(reference: string): Promise<{ paid: boolean; orderNumber: string | null }> {
  try {
    const res = await fetch('/api/checkout/express/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference }),
    });
    if (!res.ok) return { paid: false, orderNumber: null };
    const json = await res.json().catch(() => null);
    return { paid: Boolean(json?.paid), orderNumber: json?.orderNumber ?? null };
  } catch {
    // The confirmation page settles again server-side, so send them there
    // rather than telling someone who just paid that nothing was placed.
    return { paid: true, orderNumber: null };
  }
}

/**
 * Straight from a button to Cashfree's payment sheet.
 *
 * One server round trip creates the order *and* its checkout session, then the
 * sheet opens over the current page. There is no intermediate form, because
 * with One Click Checkout there is nothing left for one to ask: Cashfree signs
 * the customer in by phone number and supplies the address, contact details
 * and the choice of COD.
 *
 * Used by both entry points, so they cannot drift apart:
 *   • "Buy now" on a product page → that one item, cart untouched
 *   • "Checkout" in the bag       → everything in the bag
 *
 * Cashfree is the only checkout path. If it is unavailable, show the error
 * returned by the server instead of navigating to another checkout flow.
 */
export function useExpressCheckout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);

  /**
   * One key per attempt, so a double-tapped button cannot create two orders.
   * Regenerated only after a failure, which makes a corrected retry a genuine
   * new attempt rather than a replay of the failed one.
   */
  const idempotencyKey = React.useRef<string>(browserUuid());

  /**
   * The checkout being paid for right now. Held so that leaving the page can
   * still ask the server to settle it — a payment that completed a moment
   * before the tab closed must still become an order.
   */
  const pendingReference = React.useRef<string | null>(null);

  React.useEffect(() => {
    // `pagehide` fires for the back button and tab close alike, including the
    // bfcache path where `unload` never runs at all.
    const onLeave = () => {
      const reference = pendingReference.current;
      if (!reference) return;
      pendingReference.current = null;
      beaconRelease(reference);
    };
    window.addEventListener('pagehide', onLeave);
    return () => {
      window.removeEventListener('pagehide', onLeave);
      // Unmounting mid-payment (a client-side navigation away) strands the
      // order just as surely as closing the tab.
      onLeave();
    };
  }, []);

  const start = React.useCallback(
    async (options?: {
      buyNow?: { variantId: string; quantity: number };
    }) => {
      if (pending) return;
      setPending(true);

      try {
        const res = await fetch('/api/checkout/express', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...options, idempotencyKey: idempotencyKey.current }),
        });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          idempotencyKey.current = browserUuid();
          throw new Error(json?.error?.message ?? 'We could not start checkout.');
        }

        const reference = json.reference as string;
        // Nothing exists on the server yet but an intent — but if the customer
        // pays and then vanishes, only we know the reference, so hold it for
        // the unload handler.
        pendingReference.current = reference;

        if (json.paymentSessionId) {
          const result = await openCashfreeCheckout(json.paymentSessionId as string);
          // The sheet opens as an in-page modal (`redirectTarget: '_modal'`),
          // not a full-page redirect, so Cashfree never navigates anywhere on
          // its own — closing the modal (paid, cancelled, or failed) just
          // resolves this promise on the page the customer already had open.
          //
          // Closing it tells us nothing about whether they paid, so the server
          // is asked. That call is what creates the order, and only when the
          // gateway confirms the money arrived.
          if (result.opened) {
            const settled = await releaseOrSettle(reference);
            pendingReference.current = null;

            if (settled.paid) {
              await queryClient.invalidateQueries({ queryKey: ['cart'] });
              router.push(`/checkout/confirmation/${settled.orderNumber ?? reference}`);
              return;
            }

            idempotencyKey.current = browserUuid();
            toast({
              title: 'Payment was not completed, so no order was placed.',
              description: 'Nothing has been charged and your bag is untouched — you can try again whenever you are ready.',
              variant: 'info',
            });
            setPending(false);
            return;
          }
          console.warn('[express] Cashfree sheet unavailable:', result.reason);
        }

        if (json.redirectUrl) {
          // Leaving for the gateway's own page: it will come back through the
          // return URL, which settles server-side.
          pendingReference.current = null;
          window.location.href = json.redirectUrl as string;
          return;
        }

        // No way to take payment — nothing was created, so say so plainly.
        pendingReference.current = null;
        throw new Error('We could not open the payment screen. Please try again.');
      } catch (err) {
        toast({
          title: err instanceof Error ? err.message : 'Something went wrong.',
          variant: 'error',
        });
        setPending(false);
      }
    },
    [pending, queryClient, router, toast],
  );

  return { start, pending };
}
