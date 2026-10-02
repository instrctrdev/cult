import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling, notFound, conflict } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/audit.service';
import { adminHomepageSectionSchema } from '@/lib/validation';
import { clearAssetCache } from '@/lib/public-asset';
import { clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  const actor = await requirePermission('banners.write');
  const { id } = await ctx.params;

  const existing = await prisma.homepageSection.findUnique({ where: { id } });
  if (!existing) throw notFound('Section not found.');

  const body = adminHomepageSectionSchema.parse(await req.json());

  if (body.key !== existing.key) {
    const clash = await prisma.homepageSection.findUnique({ where: { key: body.key }, select: { id: true } });
    if (clash) throw conflict('A section with that key already exists.');
  }

  // Only one band should load eagerly; promoting one demotes the rest.
  if (body.priority && !existing.priority) {
    await prisma.homepageSection.updateMany({ where: { id: { not: id } }, data: { priority: false } });
  }

  const section = await prisma.homepageSection.update({
    where: { id },
    data: {
      ...body,
      subtitle: body.subtitle || null,
      ctaLabel: body.ctaLabel || '+ SHOP NOW',
      desktopImage: body.desktopImage || null,
      mobileImage: body.mobileImage || null,
      videoUrl: body.videoUrl || null,
      imageAlt: body.imageAlt || null,
      railSource: body.showProductRail ? body.railSource || null : null,
    },
  });

  clearAssetCache();

  await AuditService.log({
    actorId: actor.id, action: 'homepage.update', entityType: 'HomepageSection',
    entityId: id, changes: { before: { title: existing.title, isActive: existing.isActive }, after: body },
    ip: clientIp(req.headers),
  });

  return NextResponse.json(section);
});

export const DELETE = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  const actor = await requirePermission('banners.write');
  const { id } = await ctx.params;

  await prisma.homepageSection.delete({ where: { id } });

  await AuditService.log({
    actorId: actor.id, action: 'homepage.delete', entityType: 'HomepageSection',
    entityId: id, ip: clientIp(req.headers),
  });

  return NextResponse.json({ ok: true });
});
