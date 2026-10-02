import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/session';
import { getSettings } from '@/lib/settings';
import { SettingsForm } from '@/components/admin/settings-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  await requirePermission('settings.read');
  const settings = await getSettings();

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="font-serif text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Commerce rules used by the cart and checkout. Changes apply to new carts immediately.
        </p>
      </header>

      <SettingsForm
        initial={{
          shippingFee: (settings['shipping.fee_paise'] as number) / 100,
          freeThreshold: (settings['shipping.free_threshold_paise'] as number) / 100,
          freeEnabled: settings['shipping.free_enabled'] as boolean,
          prepaidFreeEnabled: settings['shipping.prepaid_free_enabled'] as boolean,
          codEnabled: settings['shipping.cod_enabled'] as boolean,
          codFee: (settings['shipping.cod_fee_paise'] as number) / 100,
          handlingPerItem: (settings['handling.per_item_paise'] as number) / 100,
          taxEnabled: settings['tax.enabled'] as boolean,
          taxRate: settings['tax.rate_percent'] as number,
          orderPrefix: settings['orders.number_prefix'] as string,
          pickupPincode: settings['store.pickup_pincode'] as string,
          lowStockThreshold: settings['inventory.low_stock_threshold'] as number,
          legalName: settings['store.legal_name'] as string,
          addressLine1: settings['store.address_line1'] as string,
          addressLine2: settings['store.address_line2'] as string,
          city: settings['store.city'] as string,
          state: settings['store.state'] as string,
          pincode: settings['store.pincode'] as string,
          gstin: settings['store.gstin'] as string,
          supportEmail: settings['store.email'] as string,
          supportPhone: settings['store.phone'] as string,
        }}
      />
    </div>
  );
}
