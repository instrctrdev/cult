'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
import { track } from '@/lib/analytics';

const KEY = ['wishlist', 'ids'] as const;
const LOCAL_KEY = 'yd_wishlist';

/** Guest wishlist lives in localStorage and is merged server-side on sign-in. */
function readLocal(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(0, 200) : [];
  } catch {
    return [];
  }
}

function writeLocal(ids: string[]) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(ids.slice(0, 200)));
  } catch {
    /* private mode / quota — the wishlist simply does not persist */
  }
}

export function useWishlist({ isSignedIn }: { isSignedIn: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [localIds, setLocalIds] = React.useState<string[]>([]);

  React.useEffect(() => setLocalIds(readLocal()), []);

  const remote = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await fetch('/api/wishlist');
      if (!res.ok) return [] as string[];
      const json = (await res.json()) as { productIds: string[] };
      return json.productIds;
    },
    enabled: isSignedIn,
  });

  const ids = React.useMemo(
    () => (isSignedIn ? remote.data ?? [] : localIds),
    [isSignedIn, remote.data, localIds],
  );
  const idSet = React.useMemo(() => new Set(ids), [ids]);

  const toggle = useMutation({
    mutationFn: async (vars: { productId: string; meta?: { id: string; name: string; price: number } }) => {
      if (!isSignedIn) {
        const current = readLocal();
        const next = current.includes(vars.productId)
          ? current.filter((id) => id !== vars.productId)
          : [...current, vars.productId];
        writeLocal(next);
        setLocalIds(next);
        return { added: next.includes(vars.productId) };
      }

      const res = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: vars.productId }),
      });
      if (!res.ok) throw new Error('Could not update your wishlist.');
      return (await res.json()) as { added: boolean };
    },
    onSuccess: (result, vars) => {
      if (isSignedIn) void qc.invalidateQueries({ queryKey: KEY });
      toast({
        title: result.added ? 'Saved to wishlist' : 'Removed from wishlist',
        variant: 'success',
      });
      if (result.added && vars.meta) track({ name: 'add_to_wishlist', item: vars.meta });
    },
    onError: (err: Error) => toast({ title: err.message, variant: 'error' }),
  });

  return {
    ids,
    has: React.useCallback((productId: string) => idSet.has(productId), [idSet]),
    toggle,
    count: ids.length,
  };
}

/** Reads the guest list so it can be POSTed for merging right after login. */
export function readGuestWishlist(): string[] {
  return readLocal();
}

export function clearGuestWishlist() {
  try {
    window.localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignore */
  }
}
