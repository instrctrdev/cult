import Link from 'next/link';
import type { HeaderNavItem } from './site-header';

/** A compact, touch-scrollable category row. It grows without crowding the header. */
export function CategoryStrip({ items }: { items: HeaderNavItem[] }) {
  if (!items.length) return null;

  return (
    <nav aria-label="Shop categories" className="border-b border-line bg-bg">
      <div className="container no-scrollbar flex gap-6 overflow-x-auto py-3.5 sm:justify-center sm:gap-9">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="shrink-0 text-2xs font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:text-danger">
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
