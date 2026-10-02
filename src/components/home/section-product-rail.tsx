import Link from 'next/link';
import { ProductRail } from '@/components/product/product-rail';
import type { ProductCardDTO } from '@/types';

/**
 * The compact product carousel that can follow an editorial band.
 *
 * Intentionally secondary to the photography: tight vertical rhythm, small
 * type, no competing headline treatment. It exists so a customer can buy
 * without leaving the campaign flow.
 */
export function SectionProductRail({
  title,
  products,
  href,
}: {
  title: string;
  products: ProductCardDTO[];
  href: string;
}) {
  if (products.length === 0) return null;

  return (
    <div className="border-b border-line-soft bg-bg">
      <ProductRail title={title} products={products} viewAllHref={href} viewAllLabel="View all" />
    </div>
  );
}

/** Standalone "view all" row used when a rail has no room for its own link. */
export function ViewAllRow({ href, label }: { href: string; label: string }) {
  return (
    <div className="container flex justify-end pb-10">
      <Link
        href={href}
        className="text-2xs font-medium uppercase tracking-luxe text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        {label} →
      </Link>
    </div>
  );
}
