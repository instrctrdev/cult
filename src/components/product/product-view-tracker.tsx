'use client';

import { useEffect } from 'react';

/**
 * Reports that this product page was viewed.
 *
 * A beacon from the browser rather than a write during render: product pages
 * are statically generated and revalidated on a timer, so a view recorded
 * server-side would miss every cached hit.
 *
 * Fires once per mount; the server also collapses repeat views of the same
 * product within half an hour, so a customer flicking between sizes or
 * reloading does not look like fresh interest.
 */
export function ProductViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const controller = new AbortController();
    // Analytics must never delay or disturb the page.
    const timer = window.setTimeout(() => {
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'PRODUCT_VIEW', productSlug: slug }),
        signal: controller.signal,
        keepalive: true,
      }).catch(() => undefined);
    }, 1200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [slug]);

  return null;
}
