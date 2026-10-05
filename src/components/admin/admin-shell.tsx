'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowUpRight, Banknote, Boxes, Image as ImageIcon, LayoutDashboard, LayoutTemplate,
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
  { href: '/admin/offline-sales', label: 'Offline billing', Icon: Banknote, permission: 'orders.read' },
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
  const currentSection = visible.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? 'Admin';

  React.useEffect(() => setMobileOpen(false), [pathname]);

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  };

  const sidebar = (
    <>
      <div className="admin-sidebar-brand px-6 pb-7 pt-8">
        <Link href="/admin/dashboard" className="font-display text-2xl font-bold tracking-[0.2em] text-white">
          CULT
        </Link>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">Control room</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-5" aria-label="Admin">
        <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Workspace</p>
        <ul className="space-y-1">
          {visible.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'admin-nav-link flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-medium transition-colors',
                    active ? 'admin-nav-active' : 'text-white/65 hover:bg-white/10 hover:text-white',
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

      <div className="border-t border-white/10 p-3">
        <div className="px-3 py-3">
          <p className="truncate text-sm font-semibold text-white">{user.name}</p>
          <p className="mt-1 truncate text-[10px] uppercase tracking-wide2 text-white/45">
            {user.role.replace('_', ' ')}
          </p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] text-white/65 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowUpRight className="h-4 w-4" />
          View store
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[13px] text-white/65 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="admin-panel min-h-dvh bg-bg">
      {/* Desktop sidebar */}
      <aside className="admin-sidebar fixed inset-y-0 left-0 z-40 hidden w-64 flex-col lg:flex">
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
          <aside className="admin-sidebar absolute inset-y-0 left-0 flex w-64 animate-slide-in-right flex-col">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:hidden">
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
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide2 text-muted">{currentSection}</span>
        </header>

        <header className="hidden h-16 items-center justify-between border-b border-line bg-white px-8 lg:flex">
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="text-faint">Control room</span>
            <span className="text-gold">/</span>
            <span className="text-ink">{currentSection}</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wide2 text-muted">{user.role.replace('_', ' ')}</span>
        </header>

        <main id="main" className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8 xl:p-10">{children}</main>
      </div>
    </div>
  );
}
