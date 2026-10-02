import Link from 'next/link';
import { BRAND } from '@/lib/brand';

/**
 * "Our positioning" section — the brand's own statement and its three
 * pillars. Every line is copy the brand supplied about itself; no invented
 * claims, testimonials or statistics have been added.
 *
 * The pillars are deliberately typographic rather than illustrated: the copy
 * itself argues against unnecessary decoration, so icons would contradict it.
 */
const PILLARS = [
  {
    label: 'Cut',
    title: 'Built around movement.',
    body: 'Relaxed structure and considered proportions that work all day and all night.',
  },
  {
    label: 'Detail',
    title: 'Nothing accidental.',
    body: 'Texture, embroidery and contrast are used with purpose, never as noise.',
  },
  {
    label: 'Identity',
    title: 'Make it yours.',
    body: 'Pieces with enough character to become part of your own uniform.',
  },
] as const;

export function BrandStory() {
  return (
    <section className="border-t border-line bg-surface" aria-labelledby="brand-story-title">
      <div className="container py-14 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow mb-4 text-danger">The CULT point of view</p>
          <h2 id="brand-story-title" className="font-serif text-2xl italic text-ink text-pretty md:text-3xl">
            {BRAND.positioning}
          </h2>
        </div>

        <ul className="mt-12 grid gap-8 md:grid-cols-3 md:gap-10">
          {PILLARS.map((pillar) => (
            <li key={pillar.label} className="text-center md:text-left">
              <p className="eyebrow text-ink">{pillar.label}</p>
              <h3 className="mt-3 font-serif text-lg">{pillar.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted text-pretty">{pillar.body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-12 text-center">
          <Link
            href="/shop"
            className="inline-flex h-12 items-center rounded-md bg-ink px-8 text-xs font-medium uppercase tracking-luxe text-bg transition-colors hover:bg-ink/90"
          >
            Shop the collection
          </Link>
        </div>
      </div>
    </section>
  );
}
