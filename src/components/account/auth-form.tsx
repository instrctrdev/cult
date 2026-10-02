'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { loginSchema, registerSchema } from '@/lib/validation';
import { readGuestWishlist, clearGuestWishlist } from '@/hooks/use-wishlist';
import { BRAND } from '@/lib/brand';

type Mode = 'login' | 'register';

/**
 * Sign in / create account.
 *
 * On success the guest cart and wishlist are merged server-side, so nothing a
 * customer collected before signing in is lost.
 */
export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const isLogin = mode === 'login';
  const schema = isLogin ? loginSchema : registerSchema;

  const form = useForm<z.input<typeof registerSchema>>({
    resolver: zodResolver(schema as never),
    defaultValues: { email: '', password: '', firstName: '', lastName: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isLogin
            ? { email: values.email, password: values.password, wishlistIds: readGuestWishlist() }
            : values,
        ),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? 'Something went wrong.');

      clearGuestWishlist();
      // Cart and wishlist both changed server-side during the merge.
      await queryClient.invalidateQueries();

      toast({ title: isLogin ? 'Welcome back' : 'Account created', variant: 'success' });
      router.push(next ?? '/account');
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  });

  return (
    <div className="container max-w-md py-12 lg:py-20">
      <div className="mb-8 text-center">
        <p className="font-display text-xl font-bold tracking-luxe">{BRAND.name}</p>
        <h1 className="mt-4 text-3xl">{isLogin ? 'Sign in' : 'Create account'}</h1>
        <p className="mt-2 text-sm text-muted">
          {isLogin ? `Welcome back to ${BRAND.name}.` : BRAND.subTagline}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError && (
          <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-danger">{formError}</p>
        )}

        {!isLogin && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="firstName" error={form.formState.errors.firstName?.message}>
              <Input autoComplete="given-name" {...form.register('firstName')} />
            </Field>
            <Field label="Last name" htmlFor="lastName" error={form.formState.errors.lastName?.message}>
              <Input autoComplete="family-name" {...form.register('lastName')} />
            </Field>
          </div>
        )}

        <Field label="Email" htmlFor="email" required error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="email" autoFocus={isLogin} {...form.register('email')} />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          required
          error={form.formState.errors.password?.message}
          hint={isLogin ? undefined : 'At least 8 characters, with a letter and a number.'}
        >
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              className="pr-11"
              {...form.register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </Field>

        {!isLogin && (
          <Field label="Mobile number" htmlFor="phone" required error={form.formState.errors.phone?.message}>
            <Input type="tel" inputMode="numeric" autoComplete="tel" {...form.register('phone')} />
          </Field>
        )}

        {isLogin && (
          <div className="text-right">
            <Link
              href="/account/forgot-password"
              className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
        )}

        <Button type="submit" size="xl" full loading={form.formState.isSubmitting}>
          {isLogin ? 'Sign in' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {isLogin ? "Don't have an account? " : 'Already have an account? '}
        <Link
          href={isLogin ? '/account/register' : '/account/login'}
          className="text-ink underline underline-offset-4"
        >
          {isLogin ? 'Create one' : 'Sign in'}
        </Link>
      </p>
    </div>
  );
}
