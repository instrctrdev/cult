import { BRAND } from '@/lib/brand';

/** The brand-word strip the live homepage runs between sections. */
export function WordMarquee() {
  return (
    <section className="overflow-hidden border-y border-line py-5" aria-label="Brand values">
      <div className="flex w-max animate-marquee motion-reduce:animate-none">
        {[0, 1].map((copy) => (
          <ul key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1 || undefined}>
            {BRAND.marquee.map((word, i) => (
              <li key={`${copy}-${i}`} className="flex items-center">
                <span className="whitespace-nowrap px-7 font-serif text-xl italic text-muted md:text-2xl">{word}</span>
                <span className="text-danger/65" aria-hidden>◆</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}
