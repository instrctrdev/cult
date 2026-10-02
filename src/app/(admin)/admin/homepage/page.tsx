import type { Metadata } from 'next';
import { requirePermission, getCurrentUser } from '@/lib/auth/session';
import { can } from '@/lib/auth/rbac';
import { HomepageService } from '@/services/homepage.service';
import { publicAsset } from '@/lib/public-asset';
import { HomepageManager } from '@/components/admin/homepage-manager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Homepage' };

export default async function AdminHomepagePage() {
  await requirePermission('banners.read');
  const user = await getCurrentUser();

  const sections = await HomepageService.listAll();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl">Homepage</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          The homepage is a sequence of full-width editorial bands. Drag to reorder, toggle a band
          on or off, and upload artwork — no deploy needed.
        </p>
      </header>

      <HomepageManager
        canWrite={Boolean(user && can(user.role, 'banners.write'))}
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
    </div>
  );
}
