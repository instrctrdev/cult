import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { adminBannerSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  await requirePermission('banners.write');
  const { id } = await ctx.params;
  const body = adminBannerSchema.parse(await req.json());

  const banner = await prisma.banner.update({
    where: { id },
    data: {
      title: body.title,
      subtitle: body.subtitle ?? null,
      eyebrow: body.eyebrow ?? null,
      placement: body.placement,
      desktopImage: body.desktopImage ?? null,
      mobileImage: body.mobileImage ?? null,
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

  return NextResponse.json(banner);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  await requirePermission('banners.write');
  const { id } = await ctx.params;
  await prisma.banner.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
