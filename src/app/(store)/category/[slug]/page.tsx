import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CategoryService } from '@/services/category.service';
import { ProductService } from '@/services/product.service';
import { productQuerySchema } from '@/lib/validation';
import { ListingPage } from '@/components/shop/listing-page';
import { BreadcrumbJsonLd } from '@/components/seo/json-ld';
import { BRAND } from '@/lib/brand';

export const revalidate = 300;

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Pre-renders every live collection at build time. */
export async function generateStaticParams() {
  const categories = await CategoryService.allSlugs();
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const category = await CategoryService.getBySlug(slug);
  if (!category) return { title: 'Collection not found' };

  return {
    title: category.name,
    description:
      category.description ??
      `Shop ${category.name.toLowerCase()} at ${BRAND.name}. ${BRAND.tagline}`,
    alternates: { canonical: `/category/${category.slug}` },
    openGraph: {
      title: `${category.name} | ${BRAND.name}`,
      description: category.description ?? BRAND.description,
      url: `/category/${category.slug}`,
      images: category.imageUrl ? [category.imageUrl] : undefined,
    },
  };
}

export default async function CategoryPage({
  params, searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const raw = await searchParams;

  const category = await CategoryService.getBySlug(slug);
  if (!category) notFound();

  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v != null),
  ) as Record<string, string>;
  const parsed = productQuerySchema.safeParse(flat);
  const q = parsed.success ? parsed.data : productQuerySchema.parse({});

  const listing = await ProductService.list({
    // The category is fixed by the route; the query string can only narrow it.
    categorySlugs: [slug],
    sizeCodes: q.size?.split(',').filter(Boolean),
    colorSlugs: q.color?.split(',').filter(Boolean),
    minPricePaise: q.minPrice != null ? q.minPrice * 100 : undefined,
    maxPricePaise: q.maxPrice != null ? q.maxPrice * 100 : undefined,
    inStockOnly: Boolean(q.inStock),
    onSaleOnly: Boolean(q.onSale),
    sort: q.sort,
    page: 1,
    perPage: q.perPage,
  });

  const breadcrumbs = [
    { name: 'Home', href: '/' },
    { name: 'Shop', href: '/shop' },
    { name: category.name, href: `/category/${category.slug}` },
  ];

  return (
    <>
      <ListingPage
        title={category.name}
        description={
          category.description ?? `${listing.total} ${listing.total === 1 ? 'style' : 'styles'}`
        }
        listing={listing}
        breadcrumbs={breadcrumbs}
        listName={`Category: ${category.name}`}
        showCategoryFilter={false}
      />
      <BreadcrumbJsonLd items={breadcrumbs} />
    </>
  );
}
