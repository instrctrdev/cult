'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { addressSchema } from '@/lib/validation';
import type { SavedAddress } from '@/types/address';

export function AddressBook({ initial }: { initial: SavedAddress[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<SavedAddress | 'new' | null>(null);

  const remove = async (id: string) => {
    const res = await fetch(`/api/account/addresses/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'Address removed', variant: 'success' });
      router.refresh();
    } else {
      toast({ title: 'Could not remove that address.', variant: 'error' });
    }
  };

  return (
    <>
      {initial.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-10 text-center">
          <MapPin className="mx-auto mb-3 h-6 w-6 text-faint" aria-hidden />
          <p className="text-sm text-muted">You have not saved an address yet.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {initial.map((address) => (
            <li key={address.id} className="relative rounded-lg border border-line p-4">
              {address.isDefault && (
                <span className="mb-2 inline-block rounded-full bg-surface px-2 py-0.5 text-2xs uppercase tracking-wide2 text-muted">
                  Default
                </span>
              )}
              <p className="text-sm font-medium text-ink">{address.fullName}</p>
              <address className="mt-1 text-sm not-italic leading-relaxed text-muted">
                {address.line1}{address.line2 ? `, ${address.line2}` : ''}<br />
                {address.city}, {address.state} {address.pincode}<br />
                {address.phone}
              </address>
              <div className="mt-3 flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(address)}>Edit</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(address.id)}
                  className="text-muted hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">Delete address for {address.fullName}</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button className="mt-6" onClick={() => setEditing('new')}>
        <Plus className="h-4 w-4" aria-hidden />
        Add address
      </Button>

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent
          side="bottom"
          title={editing === 'new' ? 'Add address' : 'Edit address'}
          className="lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:max-w-md lg:rounded-none"
        >
          {editing && (
            <AddressForm
              address={editing === 'new' ? null : editing}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function AddressForm({ address, onDone }: { address: SavedAddress | null; onDone: () => void }) {
  const { toast } = useToast();
  const form = useForm<z.input<typeof addressSchema>>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      fullName: address?.fullName ?? '',
      phone: address?.phone ?? '',
      line1: address?.line1 ?? '',
      line2: address?.line2 ?? '',
      landmark: address?.landmark ?? '',
      city: address?.city ?? '',
      state: address?.state ?? '',
      pincode: address?.pincode ?? '',
      country: 'India',
      isDefault: address?.isDefault ?? false,
    },
  });

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        const res = await fetch(
          address ? `/api/account/addresses/${address.id}` : '/api/account/addresses',
          {
            method: address ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
          },
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast({ title: json?.error?.message ?? 'Could not save the address.', variant: 'error' });
          return;
        }
        toast({ title: address ? 'Address updated' : 'Address saved', variant: 'success' });
        onDone();
      })}
      className="space-y-4 pb-4"
    >
      <Field label="Full name" htmlFor="af-name" required error={form.formState.errors.fullName?.message}>
        <Input autoComplete="name" {...form.register('fullName')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" htmlFor="af-phone" required error={form.formState.errors.phone?.message}>
          <Input type="tel" inputMode="numeric" {...form.register('phone')} />
        </Field>
        <Field label="PIN code" htmlFor="af-pin" required error={form.formState.errors.pincode?.message}>
          <Input inputMode="numeric" maxLength={6} {...form.register('pincode')} />
        </Field>
      </div>
      <Field label="Address" htmlFor="af-line1" required error={form.formState.errors.line1?.message}>
        <Input {...form.register('line1')} />
      </Field>
      <Field label="Area, colony (optional)" htmlFor="af-line2">
        <Input {...form.register('line2')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City" htmlFor="af-city" required error={form.formState.errors.city?.message}>
          <Input {...form.register('city')} />
        </Field>
        <Field label="State" htmlFor="af-state" required error={form.formState.errors.state?.message}>
          <Input {...form.register('state')} />
        </Field>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted">
        <input type="checkbox" className="h-4 w-4 accent-ink" {...form.register('isDefault')} />
        Make this my default address
      </label>

      <Button type="submit" size="lg" full loading={form.formState.isSubmitting}>
        {address ? 'Save changes' : 'Add address'}
      </Button>
    </form>
  );
}
