import { SiteHeader, type HeaderNavItem } from '@/components/store/site-header';
import { SiteFooter } from '@/components/store/site-footer';
import { StoreMain } from '@/components/store/store-main';
import { CategoryStrip } from '@/components/store/category-strip';
import { CategoryService } from '@/services/category.service';
import { WishlistService } from '@/services/wishlist.service';
import { getCurrentUser } from '@/lib/auth/session';
import { OrganizationJsonLd } from '@/components/seo/json-ld';

/**
 * Storefront shell.
 *
 * Navigation is built on the server from real categories, so the header is in
 * the initial HTML — nothing to fetch, nothing to shift after hydration.
 */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [navCandidates, user] = await Promise.all([
    CategoryService.navCandidates(),
    getCurrentUser(),
  ]);

  const wishlistCount = user ? (await WishlistService.productIds(user.id)).length : 0;

  const bySlug = new Map(navCandidates.map((c) => [c.slug, c]));

  /**
   * Garment categories in the order the brand leads with. A category earns a
   * header slot when it exists in the catalogue.
   */
  const primary: { slug: string; label: string }[] = [
    { slug: 'shirts', label: 'Shirts' },
    { slug: 'polos', label: 'Polos' },
    { slug: 'jackets', label: 'Jackets' },
    { slug: 'hoodies', label: 'Hoodies' },
    { slug: 't-shirts', label: 'T-Shirts' },
    { slug: 'kurtas', label: 'Kurta' },
    { slug: 'bottoms', label: 'Bottoms' },
  ];

  const navItems: HeaderNavItem[] = [
    ...primary
      .filter((p) => {
        const category = bySlug.get(p.slug);
        return Boolean(category);
      })
      .map((p) => ({ label: p.label, href: `/category/${p.slug}` })),
  ];

  return (
    <div className="flex min-h-dvh flex-col">
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
