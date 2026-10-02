'use client';

import { useEffect } from 'react';

const KEY = 'yd_recently_viewed';
const MAX = 12;

/**
 * Records the product in localStorage so the account page can show a
 * "recently viewed" rail. Kept client-side deliberately — it is a browsing
 * convenience, not data worth storing against an account.
 */
export function RecentlyViewedTracker({ productId }: { productId: string }) {
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      const list = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
      const next = [productId, ...list.filter((id) => id !== productId)].slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — the feature simply does nothing */
    }
  }, [productId]);

  return null;
}

export function readRecentlyViewed(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}
