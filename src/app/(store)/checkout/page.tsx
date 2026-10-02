import { redirect } from 'next/navigation';

/** Legacy URL: send visitors back to the bag, where Cashfree checkout starts. */
export default function CheckoutPage() {
  redirect('/cart');
}
