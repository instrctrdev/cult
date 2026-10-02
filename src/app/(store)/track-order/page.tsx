import type { Metadata } from 'next';
import { BRAND } from '@/lib/brand';
import { TrackOrderForm } from '@/components/store/track-order-form';

export const metadata: Metadata = {
  title: 'Track your order',
  description: `Track a ${BRAND.name} order using your order number and email address.`,
  alternates: { canonical: '/track-order' },
};

export default async function TrackOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;
  return (
    <div className="container max-w-lg py-12 lg:py-20">
      <h1 className="text-3xl">Track your order</h1>
      <p className="mt-2 text-sm text-muted">
        Enter your order number and the email you used at checkout.
      </p>
      <TrackOrderForm defaultOrderNumber={order ?? ''} />
    </div>
  );
}
