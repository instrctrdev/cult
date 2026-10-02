import type { Metadata } from 'next';
import { requirePermission, getCurrentUser } from '@/lib/auth/session';
import { can } from '@/lib/auth/rbac';
import { BannerService } from '@/services/banner.service';
import { BannerManager } from '@/components/admin/banner-manager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Banners' };

export default async function AdminBannersPage() {
  await requirePermission('banners.read');
  const user = await getCurrentUser();
  const banners = await BannerService.listAll();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl">Banners</h1>
        <p className="mt-1 text-sm text-muted">
          Homepage artwork with separate desktop and mobile images. Setting a video URL on a hero
          banner switches it to video mode — no code change needed.
        </p>
      </header>

      <BannerManager
        canWrite={Boolean(user && can(user.role, 'banners.write'))}
        banners={banners.map((b) => ({
          id: b.id,
          title: b.title,
          subtitle: b.subtitle,
          eyebrow: b.eyebrow,
          placement: b.placement,
          desktopImage: b.desktopImage,
          mobileImage: b.mobileImage,
          videoUrl: b.videoUrl,
          ctaLabel: b.ctaLabel,
          ctaHref: b.ctaHref,
          overlay: b.overlay,
          position: b.position,
          isActive: b.isActive,
          startsAt: b.startsAt ? b.startsAt.toISOString().slice(0, 10) : '',
          endsAt: b.endsAt ? b.endsAt.toISOString().slice(0, 10) : '',
        }))}
      />
    </div>
  );
}
