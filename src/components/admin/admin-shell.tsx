'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Banknote, BarChart3, Boxes, Image as ImageIcon, LayoutDashboard, LayoutTemplate,
  LogOut, Menu, Package, Settings, ShoppingCart, Sparkles, Star, Tags, Users, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { can, type Permission } from '@/lib/auth/rbac';
import type { Role } from '@/types';

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  permission: Permission;
}

const NAV: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', Icon: LayoutDashboard, permission: 'orders.read' },
  { href: '/admin/orders', label: 'Orders', Icon: ShoppingCart, permission: 'orders.read' },
  { href: '/admin/products', label: 'Products', Icon: Package, permission: 'products.read' },
  { href: '/admin/inventory', label: 'Inventory', Icon: Boxes, permission: 'inventory.read' },
  { href: '/admin/categories', label: 'Categories', Icon: Tags, permission: 'categories.read' },
  { href: '/admin/customers', label: 'Customers', Icon: Users, permission: 'customers.read' },
  { href: '/admin/coupons', label: 'Coupons', Icon: Banknote, permission: 'coupons.read' },
  { href: '/admin/homepage', label: 'Homepage', Icon: LayoutTemplate, permission: 'banners.read' },
  { href: '/admin/banners', label: 'Banners', Icon: ImageIcon, permission: 'banners.read' },
  { href: '/admin/reviews', label: 'Reviews', Icon: Star, permission: 'reviews.read' },
  { href: '/admin/settings', label: 'Settings', Icon: Settings, permission: 'settings.read' },
  { href: '/admin/ai', label: 'AI Assistant', Icon: Sparkles, permission: 'orders.read' },
];

/**
 * Admin chrome.
 *
 * Nav entries are filtered by the signed-in role, so STAFF never sees links
 * they cannot use. That is presentation only — every route re-checks the
 * permission server-side.
 */
export function AdminShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: Role };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const visible = NAV.filter((item) => can(user.role, item.permission));

  React.useEffect(() => setMobileOpen(false), [pathname]);

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  };

  const sidebar = (
    <>
      <div className="px-5 py-5">
        <Link href="/admin/dashboard" className="font-display text-lg font-bold tracking-luxe text-ink">
          CULT
        </Link>
        <p className="mt-0.5 text-2xs uppercase tracking-luxe text-faint">Admin</p>
      </div>

      <nav className="flex-1 px-3" aria-label="Admin">
        <ul className="space-y-0.5">
          {visible.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                    active ? 'bg-ink text-bg' : 'text-muted hover:bg-surface hover:text-ink',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line p-3">
        <div className="px-2 py-2">
          <p className="truncate text-sm text-ink">{user.name}</p>
          <p className="truncate text-2xs uppercase tracking-wide2 text-faint">
            {user.role.replace('_', ' ')}
          </p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
        >
          <BarChart3 className="h-4 w-4" />
          View store
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted transition-colors hover:bg-surface hover:text-danger"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh bg-bg">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-surface/40 lg:flex">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 animate-slide-in-right flex-col border-r border-line bg-bg">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg/95 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="grid h-10 w-10 place-items-center rounded-md text-ink hover:bg-surface"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="font-display text-base font-bold tracking-luxe">CULT</span>
        </header>

        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
