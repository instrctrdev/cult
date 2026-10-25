import 'server-only';
import { prisma } from '@/lib/prisma';
import { publicAsset } from '@/lib/public-asset';
import { ProductService } from '@/services/product.service';
import type { ProductCardDTO } from '@/types';
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

export interface HomepageCategoryPromoDTO {
  id: string;
  eyebrow: string | null;
  title: string;
  href: string;
  desktopImage: string;
  mobileImage: string;
  imageAlt: string;
}

export interface HomepageReelDTO {
  id: string;
  title: string;
  videoUrl: string;
  posterUrl: string | null;
  products: ProductCardDTO[];
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
        videoUrl: publicAsset(row.videoUrl),
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

  async getCategoryPromos(): Promise<HomepageCategoryPromoDTO[]> {
    const rows = await prisma.homepageCategoryPromo.findMany({
      where: { isActive: true }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], take: 12,
    });
    return rows.flatMap((row) => {
      const desktop = publicAsset(row.desktopImage);
      if (!desktop) return [];
      return [{
        id: row.id, eyebrow: row.eyebrow, title: row.title, href: row.href,
        desktopImage: desktop, mobileImage: publicAsset(row.mobileImage) ?? desktop,
        imageAlt: row.imageAlt?.trim() || row.title,
      }];
    });
  },

  async getReels(): Promise<HomepageReelDTO[]> {
    const rows = await prisma.homepageReel.findMany({
      where: { isActive: true }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: { products: { orderBy: { position: 'asc' }, select: { productId: true } } },
      take: 12,
    });
    const reels = await Promise.all(rows.flatMap((row) => {
      const videoUrl = publicAsset(row.videoUrl);
      if (!videoUrl) return [];
      return [ProductService.byIds(row.products.map((item) => item.productId)).then((products) => ({
        id: row.id, title: row.title, videoUrl,
        posterUrl: publicAsset(row.posterUrl), products,
      }))];
    }));
    return reels.filter((reel) => reel.products.length === 5);
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
