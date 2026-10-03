'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { loginSchema } from '@/lib/validation';

/** Uses the same authenticated login endpoint; the layout enforces the role. */
export function AdminLoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<z.input<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  return (
    <div className="admin-panel admin-login grid min-h-dvh place-items-center bg-bg px-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="font-display text-3xl font-bold tracking-[0.2em] text-ink">CULT</p>
          <span className="mx-auto mt-3 block h-0.5 w-9 bg-gold" aria-hidden />
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Control room</p>
          <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">Welcome back</h1>
          <p className="mt-2 text-sm text-muted">Sign in to manage your store.</p>
        </div>

        <form
          onSubmit={form.handleSubmit(async (values) => {
            setError(null);
            const res = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(values),
            });
            const json = await res.json().catch(() => ({}));

            if (!res.ok) {
              setError(json?.error?.message ?? 'Could not sign in.');
              return;
            }

            // A customer account signing in here has no admin access; the
            // layout redirects them straight back with a clear message.
            const role = json?.user?.role as string | undefined;
            if (!role || !['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
              setError('This account does not have admin access.');
              await fetch('/api/auth/logout', { method: 'POST' });
              return;
            }

            router.push(next ?? '/admin/dashboard');
            router.refresh();
          })}
          className="space-y-5 rounded-lg border border-line bg-white p-6 shadow-card sm:p-8"
          noValidate
        >
          {error && <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p>}

          <Field label="Email" htmlFor="admin-email" required error={form.formState.errors.email?.message}>
            <Input type="email" autoComplete="email" autoFocus {...form.register('email')} />
          </Field>
          <Field label="Password" htmlFor="admin-password" required error={form.formState.errors.password?.message}>
            <Input type="password" autoComplete="current-password" {...form.register('password')} />
          </Field>

          <Button type="submit" size="xl" full loading={form.formState.isSubmitting}>
            <Lock className="h-4 w-4" aria-hidden />
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
