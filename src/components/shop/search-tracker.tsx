'use client';

import { useEffect, useRef } from 'react';
import { track } from '@/lib/analytics';

/**
 * Reports a search from the results page.
 *
 * The search overlay already reports what is typed into it, but a customer who
 * arrives at /search with a term in the URL — a shared link, a bookmark, the
 * browser's own suggestions, or the back button — never touches that overlay,
 * so those searches went unrecorded. Meta's Search event is one of the few
 * signals it can build an audience from, so the gap mattered.
 */
export function SearchTracker({ term, results }: { term: string; results: number }) {
  // One report per term, not one per re-render.
  const reported = useRef<string | null>(null);

  useEffect(() => {
    if (!term || reported.current === term) return;
    reported.current = term;
    track({ name: 'search', term, results });
  }, [term, results]);

  return null;
}
