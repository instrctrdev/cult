import Image from 'next/image';
import Link from 'next/link';
import type { CategoryDTO } from '@/types';

/** "Shop by Category" — a swipeable rail on mobile, a grid on desktop. */
export function CategoryRail({ categories }: { categories: CategoryDTO[] }) {
  if (!categories.length) return null;

  return (
    <section className="py-10 md:py-14" aria-labelledby="categories-title">
      <div className="container mb-5 flex items-end justify-between md:mb-7">
        <div>
          <p className="eyebrow mb-1.5">Collections</p>
          <h2 id="categories-title" className="text-2xl md:text-3xl">Shop by category</h2>
        </div>
        <Link
          href="/shop"
          className="text-2xs font-medium uppercase tracking-wide2 text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          See all →
        </Link>
      </div>

      <div className="rail px-4 sm:px-6 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-8">
        {categories.slice(0, 8).map((category) => (
          <Link
            key={category.id}
            href={`/category/${category.slug}`}
            className="group relative isolate flex aspect-[4/5] w-[62vw] max-w-[300px] items-end overflow-hidden rounded-lg bg-surface p-5 sm:w-[44vw] lg:w-auto lg:max-w-none"
          >
            {category.imageUrl ? (
              <Image
                src={category.imageUrl}
                alt=""
                fill
                sizes="(min-width:1024px) 23vw, 62vw"
                className="-z-10 object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 -z-10 bg-gradient-to-b from-surface to-sunken" aria-hidden />
            )}
            {category.imageUrl && <div className="absolute inset-0 -z-10 bg-ink/25" aria-hidden />}

            <div className={category.imageUrl ? 'text-white' : 'text-ink'}>
              <h3 className="font-display text-lg font-semibold uppercase tracking-wide2">{category.name}</h3>
              <p className="mt-0.5 text-2xs uppercase tracking-wide2 opacity-70">
                {category.productCount} {category.productCount === 1 ? 'style' : 'styles'}
              </p>
            </div>
          </Link>
        ))}
        <div className="w-1 shrink-0 lg:hidden" aria-hidden />
      </div>
    </section>
  );
}
