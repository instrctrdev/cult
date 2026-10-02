import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { stripHtml, truncate } from '@/lib/utils';
import { BreadcrumbJsonLd } from '@/components/seo/json-ld';

/**
 * Rendered per request rather than prerendered.
 *
 * The storefront layout reads the session cookie to render the header, which
 * makes this segment dynamic. Forcing it static instead meant any page *not*
 * captured by `generateStaticParams` at build time — a policy page published
 * after the deploy, or an unrecognised slug that should simply 404 — failed
 * with DYNAMIC_SERVER_USAGE at runtime. Editorial pages are low-traffic and
 * their queries are trivial, so server-rendering them is the honest trade.
 */
export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const page = await prisma.page.findFirst({
    where: { slug, isPublished: true, deletedAt: null },
    select: { title: true, metaTitle: true, metaDescription: true, content: true },
  });
  if (!page) return { title: 'Page not found' };

  return {
    title: page.metaTitle ?? page.title,
    description:
      page.metaDescription ?? (page.content ? truncate(stripHtml(page.content), 155) : undefined),
    alternates: { canonical: `/pages/${slug}` },
  };
}

/**
 * Editorial and policy pages.
 *
 * Content is imported from the live site — none of this copy is written by the
 * application. A page with no content 404s rather than showing placeholder
 * legal text.
 */
export default async function ContentPage({ params }: { params: Params }) {
  const { slug } = await params;

  const page = await prisma.page.findFirst({
    where: { slug, isPublished: true, deletedAt: null },
    select: { title: true, content: true, updatedAt: true },
  });
  if (!page?.content) notFound();

  const breadcrumbs = [
    { name: 'Home', href: '/' },
    { name: page.title, href: `/pages/${slug}` },
  ];

  return (
    <article className="container max-w-3xl py-10 lg:py-16">
      <h1 className="text-3xl md:text-4xl">{page.title}</h1>

      <div
        className={[
          'mt-8 space-y-4 text-sm leading-relaxed text-muted',
          '[&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:text-ink',
          '[&_h3]:mt-6 [&_h3]:font-serif [&_h3]:text-lg [&_h3]:text-ink',
          '[&_p]:mb-3',
          '[&_ul]:ml-5 [&_ul]:space-y-1.5 [&_li]:list-disc',
          '[&_ol]:ml-5 [&_ol]:space-y-1.5 [&_ol_li]:list-decimal',
          '[&_strong]:text-ink [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4',
          '[&_table]:w-full [&_td]:border [&_td]:border-line [&_td]:p-2',
        ].join(' ')}
        // Sanitised during import: scripts, styles, forms and inline event
        // handlers are stripped before the HTML is ever stored.
        dangerouslySetInnerHTML={{ __html: page.content }}
      />

      <BreadcrumbJsonLd items={breadcrumbs} />
    </article>
  );
}
