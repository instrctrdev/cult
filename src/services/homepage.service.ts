import 'server-only';
import { prisma } from '@/lib/prisma';
import { publicAsset } from '@/lib/public-asset';
import type {
  SectionTextAlign, SectionTextMode, SectionTheme,
} from '@/data/homepage';

export interface HomepageSectionDTO {
  id: string;
  key: string;
  title: string;
  subtitle: string | null;
  ctaLabel: string;
  href: string;
  /** Resolved to null when the file is not on disk, so the UI can show a placeholder. */
  desktopImage: string | null;
  mobileImage: string | null;
  videoUrl: string | null;
  imageAlt: string;
  focalDesktop: string;
  focalMobile: string;
  textMode: SectionTextMode;
  textAlign: SectionTextAlign;
  theme: SectionTheme;
  overlayStrength: number;
  showProductRail: boolean;
  railSource: string | null;
  priority: boolean;
  comingSoon: boolean;
  /** The exact paths an editor should drop artwork at, shown on the placeholder. */
  expectedDesktopPath: string;
  expectedMobilePath: string;
}

export const HomepageService = {
  /** Active bands in display order, with artwork resolved against the filesystem. */
  async getSections(): Promise<HomepageSectionDTO[]> {
    const rows = await prisma.homepageSection.findMany({
      where: { isActive: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });

    return rows.map((row) => {
      const desktop = publicAsset(row.desktopImage);
      const mobile = publicAsset(row.mobileImage);

      return {
        id: row.id,
        key: row.key,
        title: row.title,
        subtitle: row.subtitle,
        ctaLabel: row.ctaLabel?.trim() || '+ SHOP NOW',
        href: row.href,
        desktopImage: desktop,
        // A landscape crop is a poor phone composition, but it beats a blank
        // band, so the desktop art is used as the mobile fallback.
        mobileImage: mobile ?? desktop,
        videoUrl: row.videoUrl,
        imageAlt: row.imageAlt?.trim() || row.title,
        focalDesktop: row.focalDesktop,
        focalMobile: row.focalMobile,
        textMode: row.textMode as SectionTextMode,
        textAlign: row.textAlign as SectionTextAlign,
        theme: row.theme as SectionTheme,
        overlayStrength: row.overlayStrength,
        showProductRail: row.showProductRail,
        railSource: row.railSource,
        priority: row.priority,
        comingSoon: row.comingSoon,
        expectedDesktopPath: row.desktopImage ?? `/images/home/${row.key}-desktop.jpg`,
        expectedMobilePath: row.mobileImage ?? `/images/home/${row.key}-mobile.jpg`,
      };
    });
  },

  /** Every band, active or not — the admin list. */
  async listAll() {
    return prisma.homepageSection.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  },

  async getById(id: string) {
    return prisma.homepageSection.findUnique({ where: { id } });
  },

  /** Persists a new order after drag-and-drop. */
  async reorder(orderedIds: string[]): Promise<void> {
    await prisma.$transaction(
      orderedIds.map((id, position) =>
        prisma.homepageSection.update({ where: { id }, data: { position } }),
      ),
    );
  },
};
