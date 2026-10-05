import { SiteHeader, type HeaderNavItem } from '@/components/store/site-header';
import { SiteFooter } from '@/components/store/site-footer';
import { StoreMain } from '@/components/store/store-main';
import { CategoryStrip } from '@/components/store/category-strip';
import { CategoryService } from '@/services/category.service';
import { WishlistService } from '@/services/wishlist.service';
import { getCurrentUser } from '@/lib/auth/session';
import { OrganizationJsonLd } from '@/components/seo/json-ld';
import { BannerService } from '@/services/banner.service';
import { AnnouncementBar } from '@/components/store/announcement-bar';

/**
 * Storefront shell.
 *
 * Navigation is built on the server from real categories, so the header is in
 * the initial HTML — nothing to fetch, nothing to shift after hydration.
 */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [navCandidates, announcements, user] = await Promise.all([
    CategoryService.navCandidates(),
    BannerService.byPlacement('ANNOUNCEMENT'),
    getCurrentUser(),
  ]);

  const wishlistCount = user ? (await WishlistService.productIds(user.id)).length : 0;

  // Admin Categories is the source for desktop and mobile navigation.
  // navCandidates already applies Active, In nav and the configured sort order.
  const navItems: HeaderNavItem[] = navCandidates.map((category) => ({
    label: category.name,
    href: `/category/${category.slug}`,
  }));

  return (
    <div className="flex min-h-dvh flex-col">
      <AnnouncementBar announcements={announcements} />
      <SiteHeader
        navItems={navItems}
        isSignedIn={Boolean(user)}
        wishlistCount={wishlistCount}
      />
      <CategoryStrip items={navItems} />

      <StoreMain>{children}</StoreMain>

      <SiteFooter />
      <OrganizationJsonLd />
    </div>
  );
}
