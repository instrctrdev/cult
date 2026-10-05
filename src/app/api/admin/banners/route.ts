import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { adminBannerSchema } from '@/lib/validation';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (req: NextRequest) => {
  await requirePermission('banners.write');
  const raw: unknown = await req.json();
  const bulk = z.object({ messages: z.array(z.string().trim().min(1).max(255)).min(1).max(20) }).safeParse(raw);
  if (bulk.success) {
    const current = await prisma.banner.aggregate({ where: { placement: 'ANNOUNCEMENT' }, _max: { position: true } });
    const firstPosition = (current._max.position ?? -1) + 1;
    const created = await prisma.banner.createMany({
      data: bulk.data.messages.map((title, index) => ({
        title, placement: 'ANNOUNCEMENT', position: firstPosition + index, isActive: true,
      })),
    });
    return NextResponse.json({ count: created.count }, { status: 201 });
  }
  const body = adminBannerSchema.parse(raw);

  const banner = await prisma.banner.create({
    data: {
      title: body.title,
      subtitle: body.subtitle ?? null,
      eyebrow: body.eyebrow ?? null,
      placement: body.placement,
      desktopImage: body.desktopImage ?? null,
      mobileImage: body.mobileImage ?? null,
      // Setting a videoUrl is what switches the hero into video mode.
      videoUrl: body.videoUrl ?? null,
      ctaLabel: body.ctaLabel ?? null,
      ctaHref: body.ctaHref ?? null,
      overlay: body.overlay ?? null,
      position: body.position,
      isActive: body.isActive,
      startsAt: body.startsAt ?? null,
      endsAt: body.endsAt ?? null,
    },
  });

  return NextResponse.json(banner, { status: 201 });
});
