import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Heart, LogOut, MapPin, Package, User } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { CustomerService } from '@/services/customer.service';
import { OrderService } from '@/services/order.service';
import { WishlistService } from '@/services/wishlist.service';
import { ProfileForm } from '@/components/account/profile-form';
import { SignOutButton } from '@/components/account/sign-out-button';
import { OrderCard } from '@/components/account/order-card';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My account',
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/account/login?next=/account');

  const [profile, orders, wishlistIds] = await Promise.all([
    CustomerService.getProfile(user.id),
    OrderService.listForUser(user.id, 1, 3),
    WishlistService.productIds(user.id),
  ]);

  return (
    <div className="container py-8 lg:py-12">
      <header className="mb-8">
        <p className="eyebrow mb-2">My account</p>
        <h1 className="text-3xl">
          {profile?.firstName ? `Hello, ${profile.firstName}` : 'Hello'}
        </h1>
        <p className="mt-1.5 text-sm text-muted">{user.email}</p>
      </header>

      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
        <nav aria-label="Account" className="mb-8 lg:mb-0">
          <ul className="flex flex-col gap-0.5">
            {[
              { href: '/account', label: 'Overview', Icon: User, current: true },
              { href: '/account/orders', label: 'Orders', Icon: Package, badge: orders.total },
              { href: '/account/addresses', label: 'Addresses', Icon: MapPin },
              { href: '/wishlist', label: 'Wishlist', Icon: Heart, badge: wishlistIds.length },
            ].map(({ href, label, Icon, badge, current }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={current ? 'page' : undefined}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors ${
                    current ? 'bg-surface font-medium text-ink' : 'text-muted hover:bg-surface hover:text-ink'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                  {badge ? <span className="ml-auto text-2xs text-faint">{badge}</span> : null}
                </Link>
              </li>
            ))}
            <li className="mt-2 border-t border-line pt-2">
              <SignOutButton>
                <span className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-muted transition-colors hover:bg-surface hover:text-danger">
                  <LogOut className="h-4 w-4" aria-hidden />
                  Sign out
                </span>
              </SignOutButton>
            </li>
          </ul>
        </nav>

        <div className="space-y-10">
          <section aria-labelledby="recent-orders">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="recent-orders" className="font-serif text-xl">Recent orders</h2>
              {orders.total > 3 && (
                <Link href="/account/orders" className="text-2xs uppercase tracking-wide2 text-muted hover:text-ink hover:underline">
                  View all →
                </Link>
              )}
            </div>

            {orders.data.length === 0 ? (
              <div className="rounded-lg border border-line p-8 text-center">
                <p className="text-sm text-muted">You have not placed an order yet.</p>
                <Link href="/shop" className="mt-3 inline-block text-2xs font-medium uppercase tracking-wide2 text-gold-ink underline underline-offset-4">
                  Start shopping
                </Link>
              </div>
            ) : (
              <ul className="space-y-3">
                {orders.data.map((order) => (
                  <li key={order.id}><OrderCard order={order} /></li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="profile">
            <h2 id="profile" className="mb-4 font-serif text-xl">Profile</h2>
            <ProfileForm
              initial={{
                firstName: profile?.firstName ?? '',
                lastName: profile?.lastName ?? '',
                phone: profile?.phone ?? '',
              }}
              email={user.email}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
