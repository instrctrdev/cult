import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { CustomerService } from '@/services/customer.service';
import { AddressBook } from '@/components/account/address-book';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My addresses',
  robots: { index: false, follow: false },
};

export default async function AddressesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/account/login?next=/account/addresses');

  const addresses = await CustomerService.listAddresses(user.id);

  return (
    <div className="container max-w-3xl py-8 lg:py-12">
      <nav aria-label="Breadcrumb" className="mb-4">
        <Link href="/account" className="text-2xs uppercase tracking-wide2 text-muted hover:text-ink hover:underline">
          ← My account
        </Link>
      </nav>
      <h1 className="mb-8 text-3xl">My addresses</h1>
      <AddressBook
        initial={addresses.map((a) => ({
          id: a.id, fullName: a.fullName, phone: a.phone,
          line1: a.line1, line2: a.line2, landmark: a.landmark,
          city: a.city, state: a.state, pincode: a.pincode,
          country: a.country, isDefault: a.isDefault,
        }))}
      />
    </div>
  );
}
