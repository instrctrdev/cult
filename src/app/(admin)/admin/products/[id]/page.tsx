import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { ProductForm } from '@/components/admin/product-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit product' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('products.read');
  const { id } = await params;

  const [product, categories, sizes, colors] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { position: 'asc' } },
        videos: { orderBy: { position: 'asc' } },
        categories: { select: { categoryId: true } },
        variants: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
          include: { inventory: true },
        },
      },
    }),
    prisma.category.findMany({ where: { deletedAt: null }, orderBy: { position: 'asc' }, select: { id: true, name: true } }),
    prisma.size.findMany({ orderBy: { position: 'asc' }, select: { id: true, code: true, label: true } }),
    prisma.color.findMany({ orderBy: { position: 'asc' }, select: { id: true, name: true, hex: true } }),
  ]);

  if (!product) notFound();

  return (
    <ProductForm
      categories={categories}
      sizes={sizes}
      colors={colors}
      data={{
        id: product.id,
        images: product.images.map((i) => ({
          id: i.id, url: i.url, alt: i.alt,
          isPlaceholder: i.isPlaceholder, aiGenerated: i.aiGenerated,
        })),
        videos: product.videos.map((v) => ({
          id: v.id, url: v.url, posterUrl: v.posterUrl, alt: v.alt,
        })),
        variants: product.variants.map((v) => ({
          id: v.id,
          sizeId: v.sizeId,
          colorId: v.colorId,
          sku: v.sku,
          price: Number(v.price),
          compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
          quantity: v.inventory?.quantity ?? 0,
          lowStockThreshold: v.inventory?.lowStockThreshold ?? 3,
          weightGrams: v.weightGrams,
          isActive: v.isActive,
        })),
        values: {
          name: product.name,
          vendor: product.vendor,
          slug: product.slug,
          subtitle: product.subtitle ?? '',
          description: product.description ?? '',
          fabric: product.fabric ?? '',
          fit: product.fit ?? '',
          sizeChartImage: product.sizeChartImage ?? '',
          price: Number(product.price),
          compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
          status: product.status,
          categoryIds: product.categories.map((c) => c.categoryId),
          isFeatured: product.isFeatured,
          isNewArrival: product.isNewArrival,
          isBestSeller: product.isBestSeller,
          metaTitle: product.metaTitle ?? '',
          metaDescription: product.metaDescription ?? '',
        },
      }}
    />
  );
}
