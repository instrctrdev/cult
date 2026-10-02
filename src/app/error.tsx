'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCw } from 'lucide-react';

/**
 * Route-level error boundary.
 *
 * The `digest` is the only detail shown — stack traces never reach the browser
 * in production. The full error is already logged server-side.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] route error', error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-muted text-pretty">
        We hit an unexpected problem loading this page. Please try again.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-12 items-center gap-2 rounded-md bg-ink px-7 text-xs font-medium uppercase tracking-luxe text-bg transition-colors hover:bg-ink/90"
        >
          <RotateCw className="h-4 w-4" aria-hidden />
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-12 items-center rounded-md border border-ink/25 px-7 text-xs font-medium uppercase tracking-luxe text-ink transition-colors hover:border-ink"
        >
          Back home
        </Link>
      </div>

      {error.digest && (
        <p className="mt-8 text-2xs uppercase tracking-wide2 text-faint">Reference: {error.digest}</p>
      )}
    </div>
  );
}
