import Link from 'next/link';

const COLLECTIONS = [
  { label: 'New Drop', href: '/shop?collection=fresh-arrivals' },
  { label: 'Shirts', href: '/category/shirts' },
  { label: 'Polos', href: '/category/polos' },
  { label: 'Overshirts', href: '/category/shirts' },
  { label: 'Bottoms', href: '/category/bottoms' },
];

/** Fast collection jumps that work as a thumb-friendly rail on phones. */
export function CultCollectionNav() {
  return (
    <section className="border-b border-line bg-bg" aria-label="Shop collections">
      <div className="container flex items-center gap-4 py-4 sm:py-5">
        <p className="shrink-0 text-xs font-bold uppercase text-danger">Shop</p>
        <div className="no-scrollbar flex min-w-0 gap-2 overflow-x-auto">
          {COLLECTIONS.map((collection) => (
            <Link
              key={collection.label}
              href={collection.href}
              className="shrink-0 border border-ink/15 px-4 py-2 text-xs font-semibold uppercase text-ink transition-colors hover:border-danger hover:bg-danger hover:text-white"
            >
              {collection.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
