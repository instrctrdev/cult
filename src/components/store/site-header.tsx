'use client';

import * as React from 'react';
import Link from 'next/link';
import { Heart, Menu, Search, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/brand';
import { useCart } from '@/hooks/use-cart';
import { CartDrawer } from './cart-drawer';
import { SearchDialog } from './search-dialog';
import { MobileMenu } from './mobile-menu';
import { CultMark } from './cult-mark';
import type { CategoryDTO } from '@/types';

export interface HeaderNavItem {
  label: string;
  href: string;
  children?: CategoryDTO[];
}

/**
 * Sticky header, in two modes.
 *
 * On the homepage it starts fully transparent so the campaign photography runs
 * edge to edge behind it, with light type. The moment the page scrolls it
 * picks up a blurred background and switches to ink type — which is what keeps
 * it readable over unpredictable photographs rather than hoping every image is
 * dark enough.
 *
 * Everywhere else it is the standard opaque header.
 *
 * Mobile is a compact app bar; the remaining destinations live in the bottom
 * tab bar and the drawer.
 */
export function SiteHeader({
  navItems,
  isSignedIn,
  wishlistCount = 0,
}: {
  navItems: HeaderNavItem[];
  isSignedIn: boolean;
  wishlistCount?: number;
}) {
  const [scrolled, setScrolled] = React.useState(false);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  const { data: cart } = useCart();
  const itemCount = cart?.itemCount ?? 0;

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const overlay = false;
  const onLightArt = false;

  return (
    <>
      <header
        data-overlay={overlay || undefined}
        className={cn(
          'sticky top-0 z-40 transition-[background-color,border-color,box-shadow,color] duration-300',
          'border-b border-line bg-bg/95 text-ink backdrop-blur-md',
          scrolled ? 'shadow-[0_1px_0_rgb(26_26_26/0.04)]' : '',
        )}
      >
        <div className="container relative flex h-[var(--header-h)] items-center justify-between gap-3">
          <div className="absolute left-3 flex items-center sm:left-4">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className={cn(
                'grid h-9 w-9 place-items-center rounded-full transition-colors sm:h-11 sm:w-11',
                overlay ? (onLightArt ? 'hover:bg-ink/5' : 'hover:bg-white/10') : 'hover:bg-surface',
              )}
            >
              <Menu className="h-[21px] w-[21px]" aria-hidden />
            </button>
            <HeaderAction label="Search products" overlay={overlay} onLightArt={onLightArt} onClick={() => setSearchOpen(true)}>
              <Search className="h-[20px] w-[20px]" aria-hidden />
            </HeaderAction>
          </div>

          <Link
            href="/"
            aria-label={`${BRAND.name} home`}
            className="absolute left-1/2 -translate-x-1/2 transition-all duration-300"
          >
            <CultMark className={cn('transition-all duration-300', scrolled ? 'text-[1.25rem] lg:text-[1.45rem]' : 'text-[1.35rem] lg:text-[1.7rem]')} />
          </Link>

        </div>
        <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0 sm:right-4">
          <HeaderAction
            label={wishlistCount ? `Wishlist, ${wishlistCount} saved` : 'Wishlist'}
            overlay={overlay}
            onLightArt={onLightArt}
            href="/wishlist"
            badge={wishlistCount}
          >
            <Heart className="h-[21px] w-[21px]" aria-hidden />
          </HeaderAction>

          <HeaderAction
            label={itemCount ? `Bag, ${itemCount} item${itemCount === 1 ? '' : 's'}` : 'Bag, empty'}
            overlay={overlay}
            onLightArt={onLightArt}
            onClick={() => setCartOpen(true)}
            badge={itemCount}
          >
            <ShoppingBag className="h-[21px] w-[21px]" aria-hidden />
          </HeaderAction>
        </div>
      </header>

      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <MobileMenu open={menuOpen} onOpenChange={setMenuOpen} navItems={navItems} isSignedIn={isSignedIn} />
    </>
  );
}

/** One header control — link or button — with consistent hit area and badge. */
function HeaderAction({
  label, overlay, onLightArt = false, href, onClick, children, className, badge,
}: {
  label: string;
  overlay: boolean;
  onLightArt?: boolean;
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  badge?: number;
}) {
  const classes = cn(
    'relative grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors sm:h-11 sm:w-11',
    overlay ? (onLightArt ? 'hover:bg-ink/5' : 'hover:bg-white/10') : 'hover:bg-surface',
    className,
  );

  const content = (
    <>
      {children}
      {badge ? (
        <span
          className="absolute right-1 top-1.5 grid min-w-[17px] place-items-center rounded-full bg-gold px-1 text-[10px] font-semibold leading-[17px] text-white"
          aria-hidden
        >
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} aria-label={label} className={classes}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} className={classes}>
      {content}
    </button>
  );
}
