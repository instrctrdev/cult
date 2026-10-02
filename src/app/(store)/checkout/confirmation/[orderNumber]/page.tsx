import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { OrderService } from '@/services/order.service';
import { CheckoutIntentService } from '@/services/checkout-intent.service';
import { PaymentService } from '@/services/payment.service';
import { getCurrentUser } from '@/lib/auth/session';
import { OrderConfirmation } from '@/components/checkout/order-confirmation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Order confirmed',
  robots: { index: false, follow: false },
};

type Params = Promise<{ orderNumber: string }>;

export default async function ConfirmationPage({ params }: { params: Params }) {
  const { orderNumber } = await params;
  const user = await getCurrentUser();

  /**
   * An express checkout arrives here with a CheckoutIntent reference, not an
   * order number — the order does not exist until the payment is confirmed.
   * Settling is what creates it, and doing it here means the gateway's own
   * return URL still produces an order when the browser never got the chance
   * to ask.
   */
  if (orderNumber.startsWith('CU-C-')) {
    const settled = await CheckoutIntentService.settle(orderNumber).catch((err) => {
      console.error('[confirmation] settling checkout failed', orderNumber, err);
      return null;
    });
    if (!settled?.order) return <CheckoutNotCompleted />;
    return <OrderConfirmation order={settled.order} isSignedIn={Boolean(user)} />;
  }

  let order = await OrderService.getByNumber(orderNumber.toUpperCase());
  if (!order) notFound();

  // A guest may only see the order they just placed in this session; a
  // signed-in customer may only see their own.
  if (order.paymentStatus === 'PENDING' && order.paymentMethod === 'PREPAID') {
    // Verify with the gateway rather than trusting the redirect that brought
    // the customer here. This is the only path that can mark an order paid.
    try {
      await PaymentService.verifyAndSettle(order.id);
      order = (await OrderService.getByNumber(orderNumber.toUpperCase())) ?? order;
    } catch (err) {
      console.error('[confirmation] verification failed', err);
    }
  }

  return <OrderConfirmation order={order} isSignedIn={Boolean(user)} />;
}

/** Shown when the customer came back from the gateway without having paid. */
function CheckoutNotCompleted() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <h1 className="font-serif text-2xl md:text-3xl">Payment was not completed</h1>
      <p className="mt-3 max-w-md text-sm text-muted text-pretty">
        Nothing has been charged and no order was placed. Your bag is exactly as you left it, so you
        can try again whenever you are ready.
      </p>
      <Link
        href="/cart"
        className="mt-8 inline-flex h-12 items-center rounded-md bg-ink px-8 text-xs font-medium uppercase tracking-luxe text-bg transition-colors hover:bg-ink/90"
      >
        Back to bag
      </Link>
    </div>
  );
}
