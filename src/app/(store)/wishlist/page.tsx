import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/session';
import { WishlistService } from '@/services/wishlist.service';
import { ProductGrid } from '@/components/product/product-grid';
import { EmptyState } from '@/components/ui/states';
import { GuestWishlist } from '@/components/store/guest-wishlist';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Wishlist',
  robots: { index: false, follow: true },
};

export default async function WishlistPage() {
  const user = await getCurrentUser();

  // Guests keep their wishlist in the browser, so it is rendered client-side.
  if (!user) {
    return (
      <div className="container py-8 lg:py-12">
        <h1 className="mb-8 text-3xl">Wishlist</h1>
        <GuestWishlist />
      </div>
    );
  }

  const products = await WishlistService.list(user.id);

  return (
    <div className="container py-8 lg:py-12">
      <h1 className="mb-1 text-3xl">Wishlist</h1>
      <p className="mb-8 text-sm text-muted">
        {products.length} saved {products.length === 1 ? 'item' : 'items'}
      </p>

      {products.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          message="Tap the heart on any product to keep it here for later."
          actionLabel="Browse collection"
          actionHref="/shop"
        />
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}
