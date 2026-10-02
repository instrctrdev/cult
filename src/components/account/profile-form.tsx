'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { profileSchema } from '@/lib/validation';

export function ProfileForm({
  initial, email,
}: {
  initial: { firstName: string; lastName: string; phone: string };
  email: string;
}) {
  const { toast } = useToast();
  const form = useForm<z.input<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: initial,
  });

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        const res = await fetch('/api/account/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
        const json = await res.json().catch(() => ({}));
        toast(
          res.ok
            ? { title: 'Profile updated', variant: 'success' }
            : { title: json?.error?.message ?? 'Could not save.', variant: 'error' },
        );
      })}
      className="max-w-lg space-y-4 rounded-lg border border-line p-5"
    >
      <Field label="Email" htmlFor="profile-email" hint="Contact us to change your email address.">
        <Input id="profile-email" value={email} disabled readOnly />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="pf-first" error={form.formState.errors.firstName?.message}>
          <Input autoComplete="given-name" {...form.register('firstName')} />
        </Field>
        <Field label="Last name" htmlFor="pf-last" error={form.formState.errors.lastName?.message}>
          <Input autoComplete="family-name" {...form.register('lastName')} />
        </Field>
      </div>

      <Field label="Mobile number" htmlFor="pf-phone" error={form.formState.errors.phone?.message}>
        <Input type="tel" inputMode="numeric" autoComplete="tel" {...form.register('phone')} />
      </Field>

      <Button type="submit" loading={form.formState.isSubmitting}>Save changes</Button>
    </form>
  );
}
