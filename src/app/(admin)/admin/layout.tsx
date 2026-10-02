import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/session';
import { isStaff } from '@/lib/auth/rbac';
import { AdminShell } from '@/components/admin/admin-shell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | CULT Admin' },
  robots: { index: false, follow: false },
};

/**
 * Authoritative admin gate.
 *
 * Middleware only checks the cookie signature at the edge. This runs against
 * the database on every request: revoked session, deactivated user or demoted
 * role all fail here.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user || !isStaff(user.role)) {
    redirect('/admin/login');
  }

  return (
    <AdminShell
      user={{
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
        email: user.email,
        role: user.role,
      }}
    >
      {children}
    </AdminShell>
  );
}
