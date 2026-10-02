import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { ProductForm } from '@/components/admin/product-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'New product' };

export default async function NewProductPage() {
  await requirePermission('products.write');

  const [categories, sizes, colors] = await Promise.all([
    prisma.category.findMany({ where: { deletedAt: null }, orderBy: { position: 'asc' }, select: { id: true, name: true } }),
    prisma.size.findMany({ orderBy: { position: 'asc' }, select: { id: true, code: true, label: true } }),
    prisma.color.findMany({ orderBy: { position: 'asc' }, select: { id: true, name: true, hex: true } }),
  ]);

  return (
    <ProductForm
      categories={categories}
      sizes={sizes}
      colors={colors}
      data={{
        id: null,
        images: [],
        videos: [],
        variants: [],
        values: {
          name: '', slug: '', subtitle: '', description: '',
          fabric: '', fit: '', sizeChartImage: '', price: 0, compareAtPrice: null,
          status: 'DRAFT', categoryIds: [],
          isFeatured: false, isNewArrival: false, isBestSeller: false,
          metaTitle: '', metaDescription: '',
        },
      }}
    />
  );
}
