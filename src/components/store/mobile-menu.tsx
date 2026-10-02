'use client';

import Link from 'next/link';
import { ChevronRight, Heart, Package, User } from 'lucide-react';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { BRAND } from '@/lib/brand';
import { CultMark } from './cult-mark';
import type { HeaderNavItem } from './site-header';

/** Slide-in navigation drawer for phones and small tablets. */
export function MobileMenu({
  open, onOpenChange, navItems, isSignedIn,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  navItems: HeaderNavItem[];
  isSignedIn: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" title="Menu" hideTitle className="max-w-[86vw] sm:max-w-sm">
        <CultMark className="text-[2rem]" />
        <p className="mt-1 text-2xs uppercase tracking-luxe text-muted">{BRAND.tagline}</p>

        <nav className="mt-7" aria-label="Mobile">
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.href}>
                <SheetClose asChild>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between rounded-md py-3.5 text-base text-ink transition-colors hover:bg-surface"
                  >
                    <span>{item.label}</span>
                    <ChevronRight className="h-4 w-4 text-faint" aria-hidden />
                  </Link>
                </SheetClose>

                {item.children && item.children.length > 0 && (
                  <ul className="mb-2 ml-3 space-y-0.5 border-l border-line pl-3">
                    {item.children.map((child) => (
                      <li key={child.id}>
                        <SheetClose asChild>
                          <Link
                            href={`/category/${child.slug}`}
                            className="flex items-center justify-between py-2.5 text-sm text-muted transition-colors hover:text-ink"
                          >
                            <span>{child.name}</span>
                            <span className="text-2xs text-faint">{child.productCount}</span>
                          </Link>
                        </SheetClose>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-7 space-y-0.5 border-t border-line pt-5">
          {[
            { href: isSignedIn ? '/account' : '/account/login', label: isSignedIn ? 'My account' : 'Sign in', Icon: User },
            { href: '/account/orders', label: 'My orders', Icon: Package },
            { href: '/wishlist', label: 'Wishlist', Icon: Heart },
          ].map(({ href, label, Icon }) => (
            <SheetClose asChild key={href}>
              <Link
                href={href}
                className="flex items-center gap-3 rounded-md py-3 text-sm text-ink transition-colors hover:bg-surface"
              >
                <Icon className="h-[18px] w-[18px] text-muted" aria-hidden />
                {label}
              </Link>
            </SheetClose>
          ))}
        </div>

        <p className="mt-7 border-t border-line pt-5 text-2xs uppercase tracking-luxe text-faint">
          Est. {BRAND.established} · {BRAND.city}, {BRAND.country}
        </p>
      </SheetContent>
    </Sheet>
  );
}
