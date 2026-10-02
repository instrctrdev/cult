import Link from 'next/link';
import { BRAND } from '@/lib/brand';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-xl font-bold tracking-luxe text-ink">{BRAND.name}</p>
      <p className="mt-10 font-serif text-6xl italic text-faint">404</p>
      <h1 className="mt-4 text-2xl">This page has gone out of stock</h1>
      <p className="mt-2 max-w-sm text-sm text-muted text-pretty">
        The page you are looking for does not exist, or has moved.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-12 items-center rounded-md bg-ink px-7 text-xs font-medium uppercase tracking-luxe text-bg transition-colors hover:bg-ink/90"
        >
          Back home
        </Link>
        <Link
          href="/shop"
          className="inline-flex h-12 items-center rounded-md border border-ink/25 px-7 text-xs font-medium uppercase tracking-luxe text-ink transition-colors hover:border-ink"
        >
          Shop the collection
        </Link>
      </div>
    </div>
  );
}
