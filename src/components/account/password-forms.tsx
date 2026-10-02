'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { forgotPasswordSchema, resetPasswordSchema } from '@/lib/validation';

export function ForgotPasswordForm() {
  const [sent, setSent] = React.useState(false);
  const [devToken, setDevToken] = React.useState<string | null>(null);

  const form = useForm<z.input<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  if (sent) {
    return (
      <div className="container max-w-md py-16 text-center">
        <MailCheck className="mx-auto mb-4 h-10 w-10 text-success" aria-hidden />
        <h1 className="text-2xl">Check your email</h1>
        <p className="mt-3 text-sm text-muted text-pretty">
          If that email has an account, we have sent a link to reset your password. The link expires in 30 minutes.
        </p>

        {/* Development only: no mail provider is configured, so the token is
            surfaced here instead of silently failing. */}
        {devToken && (
          <div className="mt-6 rounded-md bg-surface p-4 text-left">
            <p className="text-2xs uppercase tracking-wide2 text-muted">Development only</p>
            <Link
              href={`/account/reset-password?token=${devToken}`}
              className="mt-1.5 block break-all text-xs text-gold-ink underline underline-offset-4"
            >
              /account/reset-password?token={devToken}
            </Link>
          </div>
        )}

        <Link href="/account/login" className="mt-6 inline-block text-sm text-ink underline underline-offset-4">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="container max-w-md py-12 lg:py-20">
      <h1 className="text-3xl">Forgot password</h1>
      <p className="mt-2 text-sm text-muted">
        Enter your email and we will send you a link to set a new one.
      </p>

      <form
        onSubmit={form.handleSubmit(async (values) => {
          const res = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
          });
          const json = await res.json().catch(() => ({}));
          if (json?.devResetToken) setDevToken(json.devResetToken as string);
          // Always shows the same confirmation, so accounts cannot be probed.
          setSent(true);
        })}
        className="mt-8 space-y-4"
      >
        <Field label="Email" htmlFor="fp-email" required error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="email" autoFocus {...form.register('email')} />
        </Field>
        <Button type="submit" size="xl" full loading={form.formState.isSubmitting}>
          Send reset link
        </Button>
      </form>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.input<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '' },
  });

  if (!token) {
    return (
      <div className="container max-w-md py-16 text-center">
        <h1 className="text-2xl">Invalid reset link</h1>
        <p className="mt-3 text-sm text-muted">
          This link is missing its token. Please request a new one.
        </p>
        <Link href="/account/forgot-password" className="mt-6 inline-block text-sm text-ink underline underline-offset-4">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="container max-w-md py-12 lg:py-20">
      <h1 className="text-3xl">Set a new password</h1>

      <form
        onSubmit={form.handleSubmit(async (values) => {
          const res = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            toast({ title: json?.error?.message ?? 'Could not reset your password.', variant: 'error' });
            return;
          }
          toast({ title: 'Password updated — please sign in.', variant: 'success' });
          router.push('/account/login');
        })}
        className="mt-8 space-y-4"
      >
        <input type="hidden" {...form.register('token')} />
        <Field
          label="New password"
          htmlFor="rp-password"
          required
          hint="At least 8 characters, with a letter and a number."
          error={form.formState.errors.password?.message}
        >
          <Input type="password" autoComplete="new-password" autoFocus {...form.register('password')} />
        </Field>
        <Button type="submit" size="xl" full loading={form.formState.isSubmitting}>
          Update password
        </Button>
      </form>

      <p className="mt-4 text-xs text-muted">
        Updating your password signs you out everywhere else.
      </p>
    </div>
  );
}
