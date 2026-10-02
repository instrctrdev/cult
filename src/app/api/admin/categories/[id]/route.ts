import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling, notFound, conflict, badRequest } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { adminCategorySchema } from '@/lib/validation';
import { slugify } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  await requirePermission('categories.write');
  const { id } = await ctx.params;

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw notFound('Collection not found.');

  const body = adminCategorySchema.parse(await req.json());
  const slug = body.slug || slugify(body.name);

  if (slug !== existing.slug) {
    const clash = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
    if (clash) throw conflict('A collection with that URL slug already exists.');
  }
  // A category cannot be its own parent, which would orphan the tree.
  if (body.parentId === id) throw badRequest('A collection cannot be its own parent.');

  const updated = await prisma.category.update({
    where: { id },
    data: {
      slug,
      name: body.name,
      description: body.description ?? null,
      parentId: body.parentId || null,
      imageUrl: body.imageUrl ?? null,
      position: body.position,
      isActive: body.isActive,
      showInNav: body.showInNav,
      metaTitle: body.metaTitle ?? null,
      metaDescription: body.metaDescription ?? null,
    },
  });

  return NextResponse.json(updated);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  await requirePermission('categories.write');
  const { id } = await ctx.params;

  const productCount = await prisma.productCategory.count({ where: { categoryId: id } });
  if (productCount > 0) {
    throw conflict(`This collection still has ${productCount} product(s). Move them first.`);
  }

  await prisma.category.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  return NextResponse.json({ ok: true });
});
