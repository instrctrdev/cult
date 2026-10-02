'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight, MoveRight } from 'lucide-react';
import * as React from 'react';
import { ProductRail } from '@/components/product/product-rail';
import type { ProductCardDTO } from '@/types';

export interface CultHeroSlide {
  id: string;
  title: string;
  href: string;
  desktopImage: string | null;
  mobileImage: string | null;
  imageAlt: string;
  focalDesktop: string;
  focalMobile: string;
}

const editCards = [
  {
    title: 'Textured Polos',
    detail: 'Structure, softened.',
    href: '/category/polos',
    image: '/images/cult/edit-polo.jpg',
  },
  {
    title: 'Shirts In Bloom',
    detail: 'A lighter way to dress.',
    href: '/category/shirts',
    image: '/images/cult/edit-sunflower-shirt.jpg',
  },
  {
    title: 'The White Edit',
    detail: 'Easy layers, made distinct.',
    href: '/category/t-shirts',
    image: '/images/cult/edit-henley.jpg',
  },
];

const reveal = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

/** The curated storefront landing page. Product records remain available in Shop. */
export function CultHome({ slides, bestSellers }: { slides: CultHeroSlide[]; bestSellers: ProductCardDTO[] }) {
  const heroSlides = slides.filter((slide) => slide.desktopImage && slide.mobileImage);
  const [activeSlide, setActiveSlide] = React.useState(0);

  React.useEffect(() => {
    if (heroSlides.length < 2) return;

    const interval = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 5200);

    return () => window.clearInterval(interval);
  }, [heroSlides.length]);

  const selectSlide = (index: number) => {
    setActiveSlide((index + heroSlides.length) % heroSlides.length);
  };

  return (
    <div className="overflow-hidden bg-bg">
      <section aria-label="CULT campaign slides" className="relative isolate overflow-hidden bg-surface">
        <div className="relative aspect-[9/14] sm:aspect-video">
          {heroSlides.map((slide, index) => (
            <Link
              key={slide.id}
              href={slide.href}
              aria-label={`View ${slide.title}`}
              aria-hidden={index !== activeSlide}
              tabIndex={index === activeSlide ? 0 : -1}
              className={`absolute inset-0 transition-opacity duration-700 ${index === activeSlide ? 'z-10 opacity-100' : 'pointer-events-none z-0 opacity-0'}`}
            >
              <Image src={slide.mobileImage!} alt={slide.imageAlt} fill priority={index === 0} sizes="100vw" className="object-cover sm:hidden" style={{ objectPosition: slide.focalMobile }} />
              <Image src={slide.desktopImage!} alt="" fill priority={index === 0} sizes="100vw" className="hidden object-cover sm:block" style={{ objectPosition: slide.focalDesktop }} />
            </Link>
          ))}
        </div>

        {heroSlides.length > 1 && (
          <>
            <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 sm:bottom-5" aria-label="Select campaign slide">
              {heroSlides.map((slide, index) => (
                <button key={slide.id} type="button" onClick={() => selectSlide(index)} aria-label={`Show slide ${index + 1}: ${slide.title}`} aria-current={index === activeSlide} className={`h-1.5 transition-all ${index === activeSlide ? 'w-7 bg-danger' : 'w-1.5 bg-ink/35 hover:bg-ink/65'}`} />
              ))}
            </div>
          </>
        )}
      </section>

      <ProductRail
        eyebrow="Most wanted"
        title="Best Sellers"
        products={bestSellers}
        viewAllHref="/shop?collection=best-sellers"
      />

      <section id="the-edit" className="bg-surface py-14 sm:py-20">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            transition={{ staggerChildren: 0.1 }}
            className="mb-8 flex items-end justify-between gap-5 sm:mb-11"
          >
            <motion.div variants={reveal} transition={{ duration: 0.5 }}>
              <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.16em] text-danger">The CULT edit</p>
              <h2 className="max-w-[12ch] text-4xl font-medium leading-[0.95] sm:text-6xl">For the everyday standout.</h2>
            </motion.div>
            <motion.div variants={reveal} transition={{ duration: 0.5 }} className="hidden sm:block">
              <Link href="/shop" className="inline-flex items-center gap-2 border-b border-ink pb-1 text-xs font-semibold uppercase tracking-wide transition-colors hover:border-danger hover:text-danger">
                View all <MoveRight className="h-4 w-4" aria-hidden />
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.12 }}
            transition={{ staggerChildren: 0.1 }}
            className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-4 sm:gap-x-5 sm:gap-y-9"
          >
            {editCards.map((card) => (
              <motion.article key={card.title} variants={reveal} transition={{ duration: 0.5 }}>
                <Link href={card.href} className="group block">
                  <div className="relative aspect-[3/4] overflow-hidden bg-sunken">
                    <Image src={card.image} alt={card.title} fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.045]" />
                  </div>
                  <div className="pt-3">
                    <h3 className="font-sans text-sm font-semibold uppercase tracking-[0.04em] sm:text-base">{card.title}</h3>
                    <p className="mt-1 text-sm text-muted">{card.detail}</p>
                  </div>
                </Link>
              </motion.article>
            ))}

            <motion.article variants={reveal} transition={{ duration: 0.5 }}>
              <Link href="/shop" className="group flex aspect-[3/4] flex-col justify-between bg-danger p-4 text-white transition-colors hover:bg-ink sm:p-5">
                <span className="text-2xs font-semibold uppercase tracking-[0.16em] text-white/75">All pieces</span>
                <div>
                  <p className="font-script text-5xl leading-none sm:text-6xl">Cult</p>
                  <div className="mt-3 flex items-center justify-between border-t border-white/50 pt-3 text-xs font-semibold uppercase tracking-wide">
                    Shop all <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1" aria-hidden />
                  </div>
                </div>
              </Link>
            </motion.article>
          </motion.div>

          <Link href="/shop" className="mt-10 inline-flex items-center gap-2 border-b border-ink pb-1 text-xs font-semibold uppercase tracking-wide sm:hidden">
            View all <MoveRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

    </div>
  );
}
