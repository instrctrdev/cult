import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling, conflict } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/audit.service';
import { adminHomepageSectionSchema } from '@/lib/validation';
import { clearAssetCache } from '@/lib/public-asset';
import { clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** POST /api/admin/homepage — add an editorial band. */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const actor = await requirePermission('banners.write');
  const body = adminHomepageSectionSchema.parse(await req.json());

  const clash = await prisma.homepageSection.findUnique({ where: { key: body.key }, select: { id: true } });
  if (clash) throw conflict('A section with that key already exists.');

  const section = await prisma.homepageSection.create({
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

  // New artwork may already be on disk; drop the existence memo so it shows.
  clearAssetCache();

  await AuditService.log({
    actorId: actor.id, action: 'homepage.create', entityType: 'HomepageSection',
    entityId: section.id, changes: { after: body }, ip: clientIp(req.headers),
  });

  return NextResponse.json(section, { status: 201 });
});
