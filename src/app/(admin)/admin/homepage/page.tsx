import type { Metadata } from 'next';
import { requirePermission, getCurrentUser } from '@/lib/auth/session';
import { can } from '@/lib/auth/rbac';
import { HomepageService } from '@/services/homepage.service';
import { publicAsset } from '@/lib/public-asset';
import { HomepageManager } from '@/components/admin/homepage-manager';
import { HomepagePromoManager, HomepageReelManager } from '@/components/admin/home-editorial-manager';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Homepage' };

export default async function AdminHomepagePage() {
  await requirePermission('banners.read');
  const user = await getCurrentUser();

  const [sections, promos, reels, products] = await Promise.all([
    HomepageService.listAll(),
    prisma.homepageCategoryPromo.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
    prisma.homepageReel.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: { products: { orderBy: { position: 'asc' }, select: { productId: true } } },
    }),
    prisma.product.findMany({
      where: { status: 'ACTIVE', deletedAt: null, publishedAt: { not: null, lte: new Date() } },
      orderBy: { name: 'asc' }, select: { id: true, name: true },
    }),
  ]);
  const canWrite = Boolean(user && can(user.role, 'banners.write'));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl">Homepage</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Manage the single hero, category features and shoppable reels. Upload new media here to update the storefront.
        </p>
      </header>

      <HomepageManager
        canWrite={canWrite}
        sections={sections.map((s) => ({
          id: s.id,
          key: s.key,
          title: s.title,
          subtitle: s.subtitle,
          ctaLabel: s.ctaLabel,
          href: s.href,
          desktopImage: s.desktopImage,
          mobileImage: s.mobileImage,
          videoUrl: s.videoUrl,
          imageAlt: s.imageAlt,
          focalDesktop: s.focalDesktop,
          focalMobile: s.focalMobile,
          textMode: s.textMode,
          textAlign: s.textAlign,
          theme: s.theme,
          overlayStrength: s.overlayStrength,
          showProductRail: s.showProductRail,
          railSource: s.railSource,
          priority: s.priority,
          comingSoon: s.comingSoon,
          isActive: s.isActive,
          position: s.position,
          // Whether the referenced files are actually on disk right now.
          desktopOnDisk: Boolean(publicAsset(s.desktopImage)),
          mobileOnDisk: Boolean(publicAsset(s.mobileImage)),
        }))}
      />
      <HomepagePromoManager canWrite={canWrite} promos={promos.map((promo) => ({
        id: promo.id, eyebrow: promo.eyebrow, title: promo.title, href: promo.href,
        desktopImage: promo.desktopImage, mobileImage: promo.mobileImage,
        imageAlt: promo.imageAlt, position: promo.position, isActive: promo.isActive,
      }))} />
      <HomepageReelManager canWrite={canWrite} products={products} reels={reels.map((reel) => ({
        id: reel.id, title: reel.title, videoUrl: reel.videoUrl, posterUrl: reel.posterUrl,
        productIds: reel.products.map((item) => item.productId),
        position: reel.position, isActive: reel.isActive,
      }))} />
    </div>
  );
}
