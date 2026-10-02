'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export interface SettingsValues {
  shippingFee: number;
  freeThreshold: number;
  freeEnabled: boolean;
  prepaidFreeEnabled: boolean;
  codEnabled: boolean;
  codFee: number;
  handlingPerItem: number;
  taxEnabled: boolean;
  taxRate: number;
  orderPrefix: string;
  pickupPincode: string;
  lowStockThreshold: number;
  // ── Registered business identity ────────────────────────────────────────
  legalName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  supportEmail: string;
  supportPhone: string;
}

/**
 * Store settings.
 *
 * Rupee amounts are entered here and converted to integer paise before being
 * stored — the pricing engine only ever deals in paise.
 */
export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const router = useRouter();
  const { toast } = useToast();
  const form = useForm<SettingsValues>({ defaultValues: initial });

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        const res = await fetch('/api/admin/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            'shipping.fee_paise': Math.round(values.shippingFee * 100),
            'shipping.free_threshold_paise': Math.round(values.freeThreshold * 100),
            'shipping.free_enabled': values.freeEnabled,
            'shipping.prepaid_free_enabled': values.prepaidFreeEnabled,
            'shipping.cod_enabled': values.codEnabled,
            'shipping.cod_fee_paise': Math.round(values.codFee * 100),
            'handling.per_item_paise': Math.round(values.handlingPerItem * 100),
            'tax.enabled': values.taxEnabled,
            'tax.rate_percent': values.taxRate,
            'orders.number_prefix': values.orderPrefix,
            'store.pickup_pincode': values.pickupPincode,
            'inventory.low_stock_threshold': values.lowStockThreshold,
            'store.legal_name': values.legalName,
            'store.address_line1': values.addressLine1,
            'store.address_line2': values.addressLine2,
            'store.city': values.city,
            'store.state': values.state,
            'store.pincode': values.pincode,
            'store.gstin': values.gstin,
            'store.email': values.supportEmail,
            'store.phone': values.supportPhone,
          }),
        });
        const json = await res.json().catch(() => ({}));
        toast(
          res.ok
            ? { title: 'Settings saved', variant: 'success' }
            : { title: json?.error?.message ?? 'Could not save settings.', variant: 'error' },
        );
        if (res.ok) router.refresh();
      })}
      className="space-y-5"
    >
      <section className="space-y-4 rounded-lg border border-line p-5">
        <h2 className="font-serif text-lg">Shipping</h2>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-ink" {...form.register('freeEnabled')} />
          Offer free shipping above a threshold
        </label>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-ink" {...form.register('prepaidFreeEnabled')} />
          <span>
            Free delivery on prepaid orders
            <span className="mt-0.5 block text-xs text-muted">
              Cash on delivery keeps paying the flat fee. The bag and every product page say so
              before checkout — set the matching rule in Cashfree, which is what actually charges.
            </span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Flat shipping fee (Rs.)" htmlFor="s-fee">
            <Input type="number" step="1" min="0" {...form.register('shippingFee', { valueAsNumber: true })} />
          </Field>
          <Field label="Free shipping above (Rs.)" htmlFor="s-threshold">
            <Input type="number" step="1" min="0" {...form.register('freeThreshold', { valueAsNumber: true })} />
          </Field>
        </div>

        <Field label="Handling fee per item (Rs.)" htmlFor="s-handling" hint="Charged once per unit in the bag.">
          <Input type="number" step="1" min="0" {...form.register('handlingPerItem', { valueAsNumber: true })} />
        </Field>
      </section>

      <section className="space-y-4 rounded-lg border border-line p-5">
        <h2 className="font-serif text-lg">Cash on delivery</h2>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-ink" {...form.register('codEnabled')} />
          Accept cash on delivery
        </label>
        <Field label="COD surcharge (Rs.)" htmlFor="s-cod">
          <Input type="number" step="1" min="0" {...form.register('codFee', { valueAsNumber: true })} />
        </Field>
      </section>

      <section className="space-y-4 rounded-lg border border-line p-5">
        <h2 className="font-serif text-lg">Tax</h2>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-ink" {...form.register('taxEnabled')} />
          Add tax at checkout
        </label>
        <Field
          label="Tax rate (%)"
          htmlFor="s-tax"
          hint="Product prices on the live store are inclusive of tax, so this is off by default."
        >
          <Input type="number" step="0.01" min="0" max="100" {...form.register('taxRate', { valueAsNumber: true })} />
        </Field>
      </section>

      <section className="space-y-4 rounded-lg border border-line p-5">
        <h2 className="font-serif text-lg">Business identity</h2>
        <p className="-mt-1 text-xs text-muted">
          Printed on every tax invoice and shown in the site footer. Google and most payment
          gateways require a shopper to be able to see who they are buying from and from where;
          an incomplete address here is a common reason a store is refused on Google Shopping.
          Blank fields are left off rather than printed empty.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Registered business name" htmlFor="s-legal" hint="As it appears on your GST or incorporation certificate.">
            <Input id="s-legal" maxLength={150} {...form.register('legalName')} />
          </Field>
          <Field label="GSTIN" htmlFor="s-gstin" hint="Leave blank if not registered.">
            <Input id="s-gstin" maxLength={15} {...form.register('gstin')} />
          </Field>
        </div>

        <Field label="Address line 1" htmlFor="s-addr1" hint="Building, street.">
          <Input id="s-addr1" maxLength={200} {...form.register('addressLine1')} />
        </Field>
        <Field label="Address line 2" htmlFor="s-addr2" hint="Area, landmark. Optional.">
          <Input id="s-addr2" maxLength={200} {...form.register('addressLine2')} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="City" htmlFor="s-city">
            <Input id="s-city" maxLength={100} {...form.register('city')} />
          </Field>
          <Field label="State" htmlFor="s-state">
            <Input id="s-state" maxLength={100} {...form.register('state')} />
          </Field>
          <Field label="PIN code" htmlFor="s-pin">
            <Input id="s-pin" inputMode="numeric" maxLength={6} {...form.register('pincode')} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Support email" htmlFor="s-email">
            <Input id="s-email" type="email" maxLength={150} {...form.register('supportEmail')} />
          </Field>
          <Field label="Support phone" htmlFor="s-phone">
            <Input id="s-phone" maxLength={20} {...form.register('supportPhone')} />
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-line p-5">
        <h2 className="font-serif text-lg">Store</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Order number prefix" htmlFor="s-prefix" hint="e.g. CU → CU-2026-0001">
            <Input maxLength={6} {...form.register('orderPrefix')} />
          </Field>
          <Field label="Dispatch PIN code" htmlFor="s-pincode">
            <Input inputMode="numeric" maxLength={6} {...form.register('pickupPincode')} />
          </Field>
        </div>
        <Field label="Default low-stock threshold" htmlFor="s-low">
          <Input type="number" min="0" {...form.register('lowStockThreshold', { valueAsNumber: true })} />
        </Field>
      </section>

      <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
        Save settings
      </Button>
    </form>
  );
}
