'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ProductGrid } from '@/components/product/product-grid';
import { ProductGridSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { readGuestWishlist } from '@/hooks/use-wishlist';
import type { ProductCardDTO } from '@/types';

/**
 * Wishlist for signed-out visitors.
 *
 * Ids live in localStorage; the products themselves are still fetched from the
 * server so prices and stock are never stale client-side copies.
 */
export function GuestWishlist() {
  const [ids, setIds] = React.useState<string[] | null>(null);

  React.useEffect(() => setIds(readGuestWishlist()), []);

  const { data, isLoading } = useQuery({
    queryKey: ['guest-wishlist', ids],
    queryFn: async () => {
      const res = await fetch('/api/products/by-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error('Could not load your wishlist.');
      return (await res.json()) as { products: ProductCardDTO[] };
    },
    enabled: Array.isArray(ids) && ids.length > 0,
  });

  if (ids === null || (ids.length > 0 && isLoading)) return <ProductGridSkeleton count={4} />;

  if (ids.length === 0 || !data?.products.length) {
    return (
      <EmptyState
        title="Nothing saved yet"
        message="Tap the heart on any product to keep it here for later."
        actionLabel="Browse collection"
        actionHref="/shop"
      />
    );
  }

  return (
    <>
      <p className="mb-6 rounded-md bg-surface p-3 text-sm text-muted">
        Your wishlist is saved on this device.{' '}
        <Link href="/account/login?next=/wishlist" className="text-ink underline underline-offset-4">
          Sign in
        </Link>{' '}
        to keep it across devices.
      </p>
      <ProductGrid products={data.products} />
    </>
  );
}
