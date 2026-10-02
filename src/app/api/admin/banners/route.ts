import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { adminBannerSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (req: NextRequest) => {
  await requirePermission('banners.write');
  const body = adminBannerSchema.parse(await req.json());

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
