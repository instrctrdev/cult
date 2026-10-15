'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Field, Textarea } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { formatDate, cn } from '@/lib/utils';

export interface AdminCoupon {
  id: string;
  code: string;
  description: string | null;
  type: 'PERCENTAGE' | 'FIXED';
  offerType: 'STANDARD' | 'BUY_X_GET_Y' | 'BUNDLE_PRICE';
  value: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
  appliesToSubset: boolean;
  freeShipping: boolean;
  firstOrderOnly: boolean;
  autoApply: boolean;
  buyQuantity: number | null;
  getQuantity: number | null;
  bundleQuantity: number | null;
  minCompletedOrders: number | null;
  productIds: string[];
  categoryIds: string[];
}

export function CouponManager({
  coupons, categories, products, canWrite,
}: {
  coupons: AdminCoupon[];
  categories: { id: string; name: string }[];
  products: { id: string; name: string }[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<AdminCoupon | 'new' | null>(null);

  return (
    <>
      {canWrite && (
        <Button onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" aria-hidden />
          New offer
        </Button>
      )}

      {coupons.length === 0 ? (
        <p className="rounded-lg border border-line p-10 text-center text-sm text-muted">
          No offers yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line bg-surface/50 text-left">
              <tr className="text-2xs uppercase tracking-wide2 text-muted">
                <th className="p-3 font-medium">Code</th>
                <th className="p-3 font-medium">Discount</th>
                <th className="p-3 font-medium">Conditions</th>
                <th className="p-3 font-medium">Used</th>
                <th className="p-3 font-medium">Window</th>
                <th className="p-3 font-medium">Status</th>
                {canWrite && <th className="p-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {coupons.map((coupon) => {
                const expired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
                const exhausted = coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit;
                const live = coupon.isActive && !expired && !exhausted;

                return (
                  <tr key={coupon.id} className="transition-colors hover:bg-surface/40">
                    <td className="p-3">
                      {canWrite ? (
                        <button onClick={() => setEditing(coupon)} className="font-mono font-medium text-ink hover:underline">
                          {coupon.code}
                        </button>
                      ) : (
                        <span className="font-mono font-medium">{coupon.code}</span>
                      )}
                      {coupon.description && (
                        <span className="mt-0.5 block text-2xs text-faint">{coupon.description}</span>
                      )}
                    </td>
                    <td className="p-3">
                      {coupon.offerType === 'BUY_X_GET_Y'
                        ? `Buy ${coupon.buyQuantity}, get ${coupon.getQuantity} free`
                        : coupon.offerType === 'BUNDLE_PRICE'
                          ? `${coupon.bundleQuantity} for Rs. ${coupon.value}`
                          : coupon.type === 'PERCENTAGE' ? `${coupon.value}%` : `Rs. ${coupon.value}`}
                      {coupon.maxDiscount && (
                        <span className="block text-2xs text-faint">max Rs. {coupon.maxDiscount}</span>
                      )}
                    </td>
                    <td className="p-3 text-2xs text-muted">
                      {[
                        coupon.minOrderAmount ? `min Rs. ${coupon.minOrderAmount}` : null,
                        coupon.freeShipping ? 'free shipping' : null,
                        coupon.firstOrderOnly ? 'first order' : null,
                        coupon.appliesToSubset ? 'limited items' : null,
                        coupon.minCompletedOrders ? `${coupon.minCompletedOrders}+ delivered orders` : null,
                        coupon.autoApply ? 'automatic' : null,
                      ].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="p-3 tabular-nums">
                      {coupon.usedCount}{coupon.usageLimit != null ? ` / ${coupon.usageLimit}` : ''}
                    </td>
                    <td className="p-3 text-2xs text-muted">
                      {coupon.expiresAt ? `until ${formatDate(coupon.expiresAt)}` : 'no expiry'}
                    </td>
                    <td className="p-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-2xs uppercase tracking-wide2',
                          live ? 'bg-success/10 text-success' : 'bg-ink/[0.06] text-muted',
                        )}
                      >
                        {live ? 'Live' : expired ? 'Expired' : exhausted ? 'Used up' : 'Off'}
                      </span>
                    </td>
                    {canWrite && (
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          aria-label={`Delete ${coupon.code}`}
                          onClick={async () => {
                            const res = await fetch(`/api/admin/coupons/${coupon.id}`, { method: 'DELETE' });
                            toast(
                              res.ok
                                ? { title: 'Coupon removed', variant: 'success' }
                                : { title: 'Could not delete.', variant: 'error' },
                            );
                            if (res.ok) router.refresh();
                          }}
                          className="grid h-8 w-8 place-items-center rounded text-faint hover:bg-surface hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent
          side="bottom"
          title={editing === 'new' ? 'New offer' : 'Edit offer'}
          className="lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:max-w-md lg:rounded-none"
        >
          {editing && (
            <CouponForm
              coupon={editing === 'new' ? null : editing}
              categories={categories}
              products={products}
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

function CouponForm({
  coupon, categories, products, onDone,
}: {
  coupon: AdminCoupon | null;
  categories: { id: string; name: string }[];
  products: { id: string; name: string }[];
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [productIds, setProductIds] = React.useState<string[]>(coupon?.productIds ?? []);
  const [categoryIds, setCategoryIds] = React.useState<string[]>(coupon?.categoryIds ?? []);

  // Numeric fields are "" when blank, so they are typed as string | number.
  type CouponFormValues = {
    code: string;
    description: string;
    type: 'PERCENTAGE' | 'FIXED';
    offerType: 'STANDARD' | 'BUY_X_GET_Y' | 'BUNDLE_PRICE';
    value: number | string;
    minOrderAmount: number | string;
    maxDiscount: number | string;
    usageLimit: number | string;
    perUserLimit: number | string;
    startsAt: string;
    expiresAt: string;
    isActive: boolean;
    appliesToSubset: boolean;
    freeShipping: boolean;
    firstOrderOnly: boolean;
    autoApply: boolean;
    buyQuantity: number | string;
    getQuantity: number | string;
    bundleQuantity: number | string;
    minCompletedOrders: number | string;
  };

  const form = useForm<CouponFormValues>({
    defaultValues: {
      code: coupon?.code ?? '',
      description: coupon?.description ?? '',
      type: coupon?.type ?? 'PERCENTAGE',
      offerType: coupon?.offerType ?? 'STANDARD',
      value: coupon?.value ?? 10,
      minOrderAmount: coupon?.minOrderAmount ?? '',
      maxDiscount: coupon?.maxDiscount ?? '',
      usageLimit: coupon?.usageLimit ?? '',
      perUserLimit: coupon?.perUserLimit ?? '',
      startsAt: coupon?.startsAt ?? '',
      expiresAt: coupon?.expiresAt ?? '',
      isActive: coupon?.isActive ?? true,
      appliesToSubset: coupon?.appliesToSubset ?? false,
      freeShipping: coupon?.freeShipping ?? false,
      firstOrderOnly: coupon?.firstOrderOnly ?? false,
      autoApply: coupon?.autoApply ?? false,
      buyQuantity: coupon?.buyQuantity ?? 1,
      getQuantity: coupon?.getQuantity ?? 1,
      bundleQuantity: coupon?.bundleQuantity ?? 3,
      minCompletedOrders: coupon?.minCompletedOrders ?? '',
    },
  });

  const type = form.watch('type');
  const offerType = form.watch('offerType');
  const appliesToSubset = form.watch('appliesToSubset');

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        const payload = {
          ...values,
          value: Number(values.value),
          minOrderAmount: values.minOrderAmount === '' ? null : Number(values.minOrderAmount),
          maxDiscount: values.maxDiscount === '' ? null : Number(values.maxDiscount),
          usageLimit: values.usageLimit === '' ? null : Number(values.usageLimit),
          perUserLimit: values.perUserLimit === '' ? null : Number(values.perUserLimit),
          buyQuantity: values.buyQuantity === '' ? null : Number(values.buyQuantity),
          getQuantity: values.getQuantity === '' ? null : Number(values.getQuantity),
          bundleQuantity: values.bundleQuantity === '' ? null : Number(values.bundleQuantity),
          minCompletedOrders: values.minCompletedOrders === '' ? null : Number(values.minCompletedOrders),
          startsAt: values.startsAt || null,
          expiresAt: values.expiresAt || null,
          productIds,
          categoryIds,
        };

        const res = await fetch(coupon ? `/api/admin/coupons/${coupon.id}` : '/api/admin/coupons', {
          method: coupon ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast({ title: json?.error?.message ?? 'Could not save the coupon.', variant: 'error' });
          return;
        }
        toast({ title: coupon ? 'Coupon updated' : 'Coupon created', variant: 'success' });
        onDone();
      })}
      className="space-y-4 pb-4"
    >
      <Field label="Offer code" htmlFor="cp-code" required hint="Customers type this at checkout unless the offer is automatic.">
        <Input className="font-mono uppercase" {...form.register('code', { required: true })} />
      </Field>

      <Field label="Internal description" htmlFor="cp-desc">
        <Textarea rows={2} {...form.register('description')} />
      </Field>

      <Field label="Offer type" htmlFor="cp-offer-type">
        <select id="cp-offer-type" className="h-12 w-full rounded-md border border-ink/15 bg-bg px-3" {...form.register('offerType')}>
          <option value="STANDARD">Percentage / fixed discount</option>
          <option value="BUY_X_GET_Y">Buy X, get Y free</option>
          <option value="BUNDLE_PRICE">Any X items for a fixed price</option>
        </select>
      </Field>

      {offerType === 'STANDARD' && <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Discount type" htmlFor="cp-type">
          <select id="cp-type" className="h-12 w-full rounded-md border border-ink/15 bg-bg px-3" {...form.register('type')}>
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED">Fixed amount</option>
          </select>
        </Field>
        <Field label={type === 'PERCENTAGE' ? 'Percent off' : 'Amount off (Rs.)'} htmlFor="cp-value" required>
          <Input type="number" step="0.01" min="0" max={type === 'PERCENTAGE' ? 100 : undefined} {...form.register('value')} />
        </Field>
      </div>}

      {offerType === 'BUY_X_GET_Y' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer buys" htmlFor="cp-buy"><Input type="number" min="1" max="20" {...form.register('buyQuantity')} /></Field>
          <Field label="Customer gets free" htmlFor="cp-get"><Input type="number" min="1" max="20" {...form.register('getQuantity')} /></Field>
        </div>
      )}

      {offerType === 'BUNDLE_PRICE' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Number of items" htmlFor="cp-bundle-qty"><Input type="number" min="2" max="20" {...form.register('bundleQuantity')} /></Field>
          <Field label="Bundle price (Rs.)" htmlFor="cp-value"><Input type="number" min="0.01" step="0.01" {...form.register('value')} /></Field>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Minimum order (Rs.)" htmlFor="cp-min">
          <Input type="number" min="0" {...form.register('minOrderAmount')} />
        </Field>
        {offerType === 'STANDARD' && type === 'PERCENTAGE' && (
          <Field label="Maximum discount (Rs.)" htmlFor="cp-max">
            <Input type="number" min="0" {...form.register('maxDiscount')} />
          </Field>
        )}
      </div>

      <Field label="Minimum delivered purchases" htmlFor="cp-min-orders" hint="Example: enter 4 for customers who purchased more than 3 times. Blank = everyone.">
        <Input type="number" min="1" {...form.register('minCompletedOrders')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Total uses" htmlFor="cp-limit" hint="Blank = unlimited">
          <Input type="number" min="1" {...form.register('usageLimit')} />
        </Field>
        <Field label="Uses per customer" htmlFor="cp-peruser" hint="Requires sign-in">
          <Input type="number" min="1" {...form.register('perUserLimit')} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" htmlFor="cp-start">
          <Input type="date" {...form.register('startsAt')} />
        </Field>
        <Field label="Expires" htmlFor="cp-end">
          <Input type="date" {...form.register('expiresAt')} />
        </Field>
      </div>

      <div className="space-y-2">
        {[
          { key: 'isActive' as const, label: 'Active' },
          { key: 'freeShipping' as const, label: 'Also gives free shipping' },
          { key: 'firstOrderOnly' as const, label: 'First order only' },
          { key: 'autoApply' as const, label: 'Apply automatically when eligible' },
          { key: 'appliesToSubset' as const, label: 'Limit to selected products / collections' },
        ].map(({ key, label }) => (
          <label key={key} className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-ink" {...form.register(key)} />
            {label}
          </label>
        ))}
      </div>

      {appliesToSubset && (
        <div className="space-y-4 rounded-md bg-surface p-4">
          <fieldset>
            <legend className="mb-2 text-2xs uppercase tracking-wide2 text-muted">Collections</legend>
            <ul className="max-h-36 space-y-1 overflow-y-auto">
              {categories.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox" className="h-4 w-4 accent-ink"
                      checked={categoryIds.includes(c.id)}
                      onChange={(e) =>
                        setCategoryIds((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)))
                      }
                    />
                    {c.name}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-2xs uppercase tracking-wide2 text-muted">Products</legend>
            <ul className="max-h-36 space-y-1 overflow-y-auto">
              {products.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox" className="h-4 w-4 accent-ink"
                      checked={productIds.includes(p.id)}
                      onChange={(e) =>
                        setProductIds((prev) => (e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id)))
                      }
                    />
                    {p.name}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </div>
      )}

      <Button type="submit" size="lg" full loading={form.formState.isSubmitting}>
        {coupon ? 'Save offer' : 'Create offer'}
      </Button>
    </form>
  );
}
