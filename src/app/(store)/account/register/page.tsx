import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { AuthForm } from '@/components/account/auth-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Create account',
  robots: { index: false, follow: true },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  const { next } = await searchParams;

  if (user) redirect(next ?? '/account');

  return <AuthForm mode="register" next={next} />;
}
