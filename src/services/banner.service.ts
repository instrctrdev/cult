import 'server-only';
import { BannerPlacement } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface BannerDTO {
  id: string;
  title: string;
  subtitle: string | null;
  eyebrow: string | null;
  desktopImage: string | null;
  mobileImage: string | null;
  /** Empty today; the hero component already renders video when this is set. */
  videoUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  overlay: string | null;
}

export const BannerService = {
  /** Active banners for a slot, respecting the scheduling window. */
  async byPlacement(placement: BannerPlacement): Promise<BannerDTO[]> {
    const now = new Date();
    const rows = await prisma.banner.findMany({
      where: {
        placement,
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { position: 'asc' },
    });

    return rows.map((b) => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      eyebrow: b.eyebrow,
      desktopImage: b.desktopImage,
      mobileImage: b.mobileImage,
      videoUrl: b.videoUrl,
      ctaLabel: b.ctaLabel,
      ctaHref: b.ctaHref,
      overlay: b.overlay,
    }));
  },

  async listAll() {
    return prisma.banner.findMany({ orderBy: [{ placement: 'asc' }, { position: 'asc' }] });
  },
};
