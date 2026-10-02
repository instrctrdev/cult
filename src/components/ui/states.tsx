'use client';

import Link from 'next/link';
import { AlertCircle, PackageX, RotateCw, SearchX } from 'lucide-react';
import { Button } from './button';

/** Shared shell so every empty/error state is laid out identically. */
function StateShell({
  icon, title, message, children,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-16 text-center">
      <div className="mb-5 grid h-14 w-14 place-items-center rounded-full bg-surface text-muted" aria-hidden>
        {icon}
      </div>
      <h2 className="font-serif text-xl text-ink">{title}</h2>
      <p className="mt-2 text-sm text-muted text-pretty">{message}</p>
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}

export function EmptyState({
  title, message, actionLabel, actionHref,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <StateShell icon={<PackageX className="h-6 w-6" />} title={title} message={message}>
      {actionLabel && actionHref && (
        <Button asChild size="lg">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </StateShell>
  );
}

export function NoResultsState({ query, onClear }: { query?: string; onClear?: () => void }) {
  return (
    <StateShell
      icon={<SearchX className="h-6 w-6" />}
      title={query ? `No results for “${query}”` : 'Nothing matches those filters'}
      message="Try a different spelling, a broader term, or clear a filter or two."
    >
      {onClear && (
        <Button variant="outline" size="lg" onClick={onClear}>
          Clear filters
        </Button>
      )}
      <Button asChild size="lg">
        <Link href="/shop">Browse everything</Link>
      </Button>
    </StateShell>
  );
}

/** Retry state — used by error boundaries and failed fetches. */
export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this just now. Please try again.',
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <StateShell icon={<AlertCircle className="h-6 w-6 text-danger" />} title={title} message={message}>
      {onRetry && (
        <Button variant="outline" size="lg" onClick={onRetry}>
          <RotateCw className="h-4 w-4" aria-hidden />
          Try again
        </Button>
      )}
    </StateShell>
  );
}
