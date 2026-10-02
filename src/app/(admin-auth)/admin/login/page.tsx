import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { isStaff } from '@/lib/auth/rbac';
import { AdminLoginForm } from '@/components/admin/admin-login-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin sign in',
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  const { next } = await searchParams;

  if (user && isStaff(user.role)) redirect(next ?? '/admin/dashboard');

  return <AdminLoginForm next={next} />;
}
