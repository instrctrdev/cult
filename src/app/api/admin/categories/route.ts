import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling, conflict } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { adminCategorySchema } from '@/lib/validation';
import { slugify } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (req: NextRequest) => {
  await requirePermission('categories.write');
  const body = adminCategorySchema.parse(await req.json());

  const slug = body.slug || slugify(body.name);
  const clash = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
  if (clash) throw conflict('A collection with that URL slug already exists.');

  const category = await prisma.category.create({
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

  return NextResponse.json(category, { status: 201 });
});
