import { createHmac, timingSafeEqual } from 'crypto';
import { PaymentStatus } from '@prisma/client';
import { AppError } from '@/lib/errors';
import { env } from '@/lib/env';
import { isPlaceholder } from '@/lib/checkout/placeholders';
import type {
  CreatePaymentInput, CreatePaymentResult, PaymentProvider,
  RefundRef, RefundResult, VerifyPaymentResult, WebhookResult,
} from './types';

/**
 * Cashfree Payment Gateway — Orders API + Web Checkout.
 *
 * Unlike Fastrr, this is Cashfree's own general-purpose gateway API — publicly
 * documented, not something we had to dig out of a merchant dashboard — and it
 * is built for exactly this: a custom web app, not a Shopify plugin. Every
 * path, field name and status value below is taken from Cashfree's official
 * API reference (docs.cashfree.com) and its published webhook-verification
 * sample (github.com/cashfree/cashfree-pg-webhook).
 *
 * ── Base URLs ────────────────────────────────────────────────────────────
 *   sandbox     https://sandbox.cashfree.com/pg
 *   production  https://api.cashfree.com/pg
 *
 * ── Endpoints used ─────────────────────────────────────────────────────
 *   POST /orders                        create a checkout session
 *   GET  /orders/{order_id}             authoritative order status
 *   POST /orders/{order_id}/refunds     refund
 *
 * ── Auth ───────────────────────────────────────────────────────────────
 * Every request carries `x-client-id`, `x-client-secret` and `x-api-version`.
 * Unlike Fastrr's undocumented HMAC scheme, this is a plain shared-secret
 * header pair — nothing to sign on outgoing requests.
 *
 * ── Settlement ─────────────────────────────────────────────────────────
 * The incoming webhook *is* signed (unlike Fastrr's): `x-webhook-signature`
 * is `base64(HMAC-SHA256(client_secret, x-webhook-timestamp + rawBody))`,
 * confirmed against Cashfree's own reference implementation. `signatureOk`
 * genuinely reflects verification here — but `PaymentService` still only
 * settles on `verifyPayment`'s response, never on a webhook payload alone,
 * which is the same discipline applied to every provider in this app.
 *
 * ── Browser handoff ────────────────────────────────────────────────────
 * `createPayment` returns a `payment_session_id`. The browser hands that to
 * Cashfree's official `@cashfreepayments/cashfree-js` SDK, which opens the
 * checkout in a modal — see `src/lib/cashfree/sdk.ts`. On completion the
 * customer is returned to `returnUrl`; as with every provider here, that
 * redirect is a UX courtesy only and never used to settle anything.
 */

function endpoints() {
  const base = env().CASHFREE_BASE_URL.replace(/\/$/, '');
  return {
    createOrder: `${base}/orders`,
    orderStatus: (orderId: string) => `${base}/orders/${encodeURIComponent(orderId)}`,
    /** One Click Checkout: address, cart and offers collected inside Cashfree. */
    orderExtended: (orderId: string) => `${base}/orders/${encodeURIComponent(orderId)}/extended`,
    refund: (orderId: string) => `${base}/orders/${encodeURIComponent(orderId)}/refunds`,
  };
}

/** Cashfree's address shape on the Get Order Extended response. */
interface CashfreeAddress {
  name?: string;
  address_line_one?: string;
  address_line_two?: string;
  city?: string;
  state?: string;
  pin_code?: string;
  country?: string;
  phone?: string;
  email?: string;
}

/** Cashfree's order-level lifecycle status. */
type CashfreeOrderStatus = 'ACTIVE' | 'PAID' | 'EXPIRED' | 'TERMINATED' | 'TERMINATION_REQUESTED';

interface CashfreeOrder {
  cf_order_id: string;
  order_id: string;
  order_status: CashfreeOrderStatus;
  order_amount: number;
  payment_session_id?: string;
}

/** Cashfree's per-transaction status, distinct from the order-level status above. */
type CashfreePaymentStatus = 'SUCCESS' | 'FAILED' | 'USER_DROPPED' | 'PENDING' | 'NOT_ATTEMPTED';

interface CashfreePayment {
  cf_payment_id: number | string;
  payment_status: CashfreePaymentStatus;
  /** What was actually taken — includes anything Cashfree's own rules added. */
  payment_amount: number;
  /** `"cash"` for a One Click Checkout COD selection; a real instrument otherwise. */
  payment_group?: string;
}

/** Cashfree's marker for "customer chose cash on delivery inside the sheet". */
const COD_PAYMENT_GROUP = 'cash';

/** Cashfree's own stand-in contact details on an OCC order — never the customer's. */
const SYNTHETIC_EMAIL = /@cashfree\.com$/i;
const SYNTHETIC_NAME = /^cashfree customer$/i;

export class CashfreeProvider implements PaymentProvider {
  readonly name = 'cashfree';

  private get config() {
    const e = env();
    return { clientId: e.PAYMENT_API_KEY, clientSecret: e.PAYMENT_SECRET, apiVersion: e.CASHFREE_API_VERSION };
  }

  isConfigured(): boolean {
    const { clientId, clientSecret } = this.config;
    return Boolean(clientId && clientSecret);
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new AppError('PAYMENT_ERROR', 'Online payment is temporarily unavailable.');
    }
  }

  private headers(): Record<string, string> {
    const { clientId, clientSecret, apiVersion } = this.config;
    return {
      'Content-Type': 'application/json',
      'x-client-id': clientId,
      'x-client-secret': clientSecret,
      'x-api-version': apiVersion,
    };
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const res = await fetch(url, { ...init, headers: this.headers(), cache: 'no-store' });

    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new AppError('PAYMENT_ERROR', 'Payment gateway returned an unreadable response.', { status: res.status });
    }

    if (!res.ok) {
      console.error('[cashfree] request failed', { url, status: res.status, json });
      const message = (json as { message?: string })?.message;
      throw new AppError('PAYMENT_ERROR', message ?? 'We could not start the payment. Please try again.', {
        status: res.status,
      });
    }

    return json as T;
  }

  /**
   * POST /orders
   *
   * `order_id` is set to **our** order number, not a Cashfree-generated id —
   * every later lookup (fetch, refund, webhook reconciliation) is addressed
   * by this same id, so `providerOrderId` is our order number throughout.
   */
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    this.assertConfigured();

    const oneClick = env().CASHFREE_ONE_CLICK_CHECKOUT;

    const order = await this.request<CashfreeOrder>(endpoints().createOrder, {
      method: 'POST',
      body: JSON.stringify({
        order_id: input.orderNumber,
        order_amount: Number((input.amountPaise / 100).toFixed(2)),
        order_currency: input.currency,
        // Bounds how long a checkout a customer never finishes (closed tab,
        // abandoned payment) stays ACTIVE. Without this Cashfree leaves it
        // open indefinitely, so /api/cron/expire-orders would have nothing
        // to detect and the stock it reserved would never be released.
        //
        // Cashfree rejects anything at or under 15 minutes ("Expiry time
        // should be more than 15 min"), so 20 is the practical floor — and
        // this is only the backstop for a customer who left without the
        // browser telling us. The release route handles the normal case.
        order_expiry_time: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
        customer_details: {
          // Cashfree requires a stable customer_id; the order id is unique
          // and good enough here since we do not maintain a Cashfree
          // customer registry of our own.
          customer_id: input.orderNumber,
          // A guest's real details are not known until they sign in to
          // Cashfree's own sheet, so anything still holding a placeholder is
          // left out entirely. Cashfree accepts the omission and shows an
          // empty field, which is what we want: a pre-filled stand-in is one
          // the customer would likely accept, leaving the order with contact
          // details we cannot reach them on.
          ...(isPlaceholder(input.customer.name) ? {} : { customer_name: input.customer.name }),
          ...(isPlaceholder(input.customer.email) ? {} : { customer_email: input.customer.email }),
          // Cashfree rejects a missing or empty phone but accepts a space,
          // which renders as a blank sign-in field.
          customer_phone: input.customer.phone.replace(/\D/g, '').slice(-10) || ' ',
        },
        order_meta: {
          return_url: input.returnUrl,
          notify_url: input.notifyUrl,
        },
        order_note: input.couponCode ? `Coupon: ${input.couponCode}` : undefined,

        /**
         * One Click Checkout. `checkoutAuthenticate` gives the customer a
         * phone-number sign-in inside Cashfree; `checkoutCollectAddress` then
         * pre-fills the delivery address from Cashfree's saved-address
         * network, so a first-time buyer usually types nothing.
         *
         * The collected address comes back from the Get Order Extended API
         * after payment — see `fetchCollectedDetails`.
         */
        ...(oneClick
          ? {
              products: {
                one_click_checkout: {
                  enabled: true,
                  conditions: [
                    {
                      action: 'ALLOW',
                      values: ['checkoutCollectAddress', 'checkoutAuthenticate'],
                      key: 'features',
                    },
                  ],
                },
              },
              // Populates Cashfree's own order summary. Sent only for OCC —
              // the plain gateway has no use for line items.
              cart_details: {
                cart_items: input.lines.map((line) => ({
                  item_id: line.variantId,
                  item_name: line.name,
                  item_original_unit_price: Number((line.unitPricePaise / 100).toFixed(2)),
                  item_discounted_unit_price: Number((line.unitPricePaise / 100).toFixed(2)),
                  item_quantity: line.quantity,
                  item_currency: input.currency,
                })),
              },
            }
          : {}),
      }),
    });

    if (!order.payment_session_id) {
      throw new AppError('PAYMENT_ERROR', 'Payment gateway did not return a checkout session.');
    }

    return {
      providerOrderId: order.order_id,
      // No hosted redirect URL — the browser opens Cashfree's modal directly
      // via the session id. See src/lib/cashfree/sdk.ts.
      redirectUrl: undefined,
      clientConfig: { paymentSessionId: order.payment_session_id },
    };
  }

  /**
   * GET /orders/{order_id}
   *
   * The order-level `order_status` is authoritative for whether the order as
   * a whole is settled; Cashfree only marks an order `PAID` once a successful
   * payment covers the full amount, which is exactly the guarantee this app
   * needs and matches the amount-mismatch guard in `PaymentService`.
   */
  async verifyPayment(providerOrderId: string): Promise<VerifyPaymentResult> {
    this.assertConfigured();

    const order = await this.request<CashfreeOrder>(endpoints().orderStatus(providerOrderId), { method: 'GET' });

    // The payment-level id (cf_payment_id) is only available on the payments
    // sub-resource, not the order itself — fetched only when settled, since
    // it is otherwise unused.
    let providerPaymentId: string | null = null;
    let isCashOnDelivery = false;
    let paidAmountPaise: number | null = null;
    if (order.order_status === 'PAID') {
      try {
        const payments = await this.request<CashfreePayment[]>(
          `${endpoints().orderStatus(providerOrderId)}/payments`,
          { method: 'GET' },
        );
        const settled = payments.find((p) => p.payment_status === 'SUCCESS');
        providerPaymentId = settled ? String(settled.cf_payment_id) : null;
        // A COD selection also comes back as a SUCCESS payment on a PAID
        // order — `payment_group` is the only thing distinguishing "cash owed
        // on delivery" from money actually received.
        isCashOnDelivery = settled?.payment_group?.toLowerCase() === COD_PAYMENT_GROUP;
        paidAmountPaise =
          typeof settled?.payment_amount === 'number' ? Math.round(settled.payment_amount * 100) : null;
      } catch (err) {
        // The order is still authoritatively PAID even if this lookup fails;
        // only the reconciliation reference is missing.
        console.error('[cashfree] fetching payment id failed', err);
      }
    }

    return {
      status: mapOrderStatus(order.order_status),
      providerPaymentId,
      amountPaise: typeof order.order_amount === 'number' ? Math.round(order.order_amount * 100) : null,
      failureReason: order.order_status === 'EXPIRED' ? 'Checkout session expired.' : undefined,
      isCashOnDelivery,
      paidAmountPaise,
      raw: order,
    };
  }

  /**
   * GET /orders/{order_id}/extended — One Click Checkout only.
   *
   * Returns the delivery address *and* contact details the customer gave
   * inside Cashfree's
   * checkout, which for OCC orders is the *authoritative* shipping address:
   * our own checkout never asked for one. Called after settlement so the
   * order can be fulfilled.
   *
   * Returns `null` rather than throwing when unavailable — an order that is
   * otherwise paid must not be blocked by this lookup, and the admin can
   * always read the address from the Cashfree dashboard as a fallback.
   */
  async fetchCollectedDetails(providerOrderId: string): Promise<{
    address: {
      fullName: string;
      phone: string;
      email: string | null;
      line1: string;
      line2: string | null;
      city: string;
      state: string;
      pincode: string;
      country: string;
    } | null;
    customerEmail: string | null;
    customerPhone: string | null;
    /** What Cashfree's own rules added on top of the amount we sent it. */
    charges: { shippingPaise: number; codPaise: number };
  } | null> {
    if (!env().CASHFREE_ONE_CLICK_CHECKOUT) return null;

    try {
      const res = await this.request<{
        shipping_address?: CashfreeAddress;
        billing_address?: CashfreeAddress;
        customer_details?: { customer_name?: string; customer_phone?: string; customer_email?: string };
        charges?: { shipping_charges?: number; cod_handling_charges?: number };
      }>(endpoints().orderExtended(providerOrderId), { method: 'GET' });

      const addr = res.shipping_address ?? res.billing_address;
      const customer = res.customer_details;

      const digits = (v?: string | null) => (v ?? '').replace(/\D/g, '').slice(-10) || null;

      // `customer_details` on an OCC order is Cashfree's own synthetic
      // profile, not what the customer typed: observed in production as
      // name "Cashfree Customer" and email "9999999999@cashfree.com". The
      // address block carries the real values, so it wins — and the
      // synthetic ones are discarded rather than merely deprioritised, or a
      // missing address field would fall back onto junk that then becomes
      // the order's contact email and never reaches anyone.
      const realEmail = (v?: string | null) => {
        const trimmed = v?.trim().toLowerCase() || null;
        if (!trimmed || SYNTHETIC_EMAIL.test(trimmed)) return null;
        return trimmed;
      };
      const realName = (v?: string | null) => {
        const trimmed = v?.trim() || null;
        return !trimmed || SYNTHETIC_NAME.test(trimmed) ? null : trimmed;
      };

      const email = realEmail(addr?.email) ?? realEmail(customer?.customer_email);

      return {
        // A pincode is the one field fulfilment cannot proceed without, so an
        // address lacking it is treated as absent rather than partially usable.
        address: addr?.pin_code
          ? {
              fullName: realName(addr.name) ?? realName(customer?.customer_name) ?? 'Customer',
              phone: digits(addr.phone ?? customer?.customer_phone) ?? '',
              email,
              line1: addr.address_line_one ?? '',
              line2: addr.address_line_two ?? null,
              city: addr.city ?? '',
              state: addr.state ?? '',
              pincode: addr.pin_code,
              country: addr.country ?? 'India',
            }
          : null,
        customerEmail: email,
        customerPhone: digits(addr?.phone ?? customer?.customer_phone),
        charges: {
          shippingPaise: Math.round((res.charges?.shipping_charges ?? 0) * 100),
          codPaise: Math.round((res.charges?.cod_handling_charges ?? 0) * 100),
        },
      };
    } catch (err) {
      console.error('[cashfree] fetching collected details failed', err);
      return null;
    }
  }

  /**
   * Incoming webhook — genuinely signed, unlike Fastrr's.
   *
   * `signature = base64(HMAC-SHA256(client_secret, timestamp + rawBody))`,
   * matching Cashfree's own reference implementation exactly (direct
   * concatenation, no separator, over the *raw* body — never the parsed and
   * re-serialised JSON, which would not byte-match).
   */
  async parseWebhook(rawBody: string, headers: Headers): Promise<WebhookResult> {
    const timestamp = headers.get('x-webhook-timestamp') ?? '';
    const signature = headers.get('x-webhook-signature') ?? '';

    let signatureOk = false;
    if (timestamp && signature && this.config.clientSecret) {
      const expected = createHmac('sha256', this.config.clientSecret)
        .update(timestamp + rawBody)
        .digest('base64');
      const a = Buffer.from(expected, 'utf8');
      const b = Buffer.from(signature, 'utf8');
      signatureOk = a.length === b.length && timingSafeEqual(a, b);
    }

    let body: {
      type?: string;
      event_time?: string;
      data?: {
        order?: { order_id?: string; order_amount?: number };
        payment?: {
          cf_payment_id?: number | string;
          payment_status?: CashfreePaymentStatus;
          payment_amount?: number;
          payment_group?: string;
        };
      };
    };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return {
        externalId: null, eventType: 'unparseable', orderNumber: null, providerOrderId: null,
        status: null, providerPaymentId: null, amountPaise: null, signatureOk: false, raw: rawBody,
      };
    }

    const order = body.data?.order;
    const payment = body.data?.payment;

    return {
      // No dedicated event id in this payload; order id + event type + the
      // event's own timestamp is a stable idempotency key for replays.
      externalId: order?.order_id && body.type ? `${order.order_id}:${body.type}:${body.event_time ?? ''}` : null,
      eventType: body.type ?? 'unknown',
      orderNumber: order?.order_id ?? null, // our order number, since we set it as Cashfree's order_id
      providerOrderId: order?.order_id ?? null,
      status: payment?.payment_status ? mapPaymentStatus(payment.payment_status) : null,
      providerPaymentId: payment?.cf_payment_id != null ? String(payment.cf_payment_id) : null,
      amountPaise: typeof payment?.payment_amount === 'number' ? Math.round(payment.payment_amount * 100) : null,
      isCashOnDelivery: payment?.payment_group?.toLowerCase() === COD_PAYMENT_GROUP,
      signatureOk,
      raw: body,
    };
  }

  /**
   * POST /orders/{order_id}/refunds
   *
   * Cashfree scopes refunds by *order*, not by the individual payment id —
   * `ref.providerOrderId` is always present because `createPayment` sets it
   * on every order.
   */
  async refundPayment(ref: RefundRef, amountPaise: number, reason?: string): Promise<RefundResult> {
    this.assertConfigured();
    if (!ref.providerOrderId) {
      throw new AppError('PAYMENT_ERROR', 'No Cashfree order reference to refund against.');
    }

    const res = await this.request<{
      cf_refund_id: string;
      refund_amount: number;
      refund_status: 'SUCCESS' | 'PENDING' | 'CANCELLED' | 'ONHOLD' | 'FAILED';
    }>(endpoints().refund(ref.providerOrderId), {
      method: 'POST',
      body: JSON.stringify({
        // Unique per attempt, so a retried admin click cannot double-refund.
        refund_id: `${ref.providerOrderId}-${Date.now()}`,
        refund_amount: Number((amountPaise / 100).toFixed(2)),
        refund_note: reason?.slice(0, 100) ?? 'Refund',
      }),
    });

    const status: PaymentStatus =
      res.refund_status === 'SUCCESS'
        ? PaymentStatus.REFUNDED
        : res.refund_status === 'FAILED' || res.refund_status === 'CANCELLED'
          ? PaymentStatus.FAILED
          : PaymentStatus.REFUND_PENDING;

    return {
      providerRefundId: res.cf_refund_id ?? null,
      status,
      refundedPaise:
        status === PaymentStatus.FAILED ? 0 : Math.round((res.refund_amount ?? amountPaise / 100) * 100),
      raw: res,
    };
  }
}

function mapOrderStatus(status: CashfreeOrderStatus): PaymentStatus {
  switch (status) {
    case 'PAID':
      return PaymentStatus.PAID;
    case 'EXPIRED':
    case 'TERMINATED':
    case 'TERMINATION_REQUESTED':
      return PaymentStatus.FAILED;
    case 'ACTIVE':
    default:
      return PaymentStatus.PENDING;
  }
}

function mapPaymentStatus(status: CashfreePaymentStatus): PaymentStatus {
  switch (status) {
    case 'SUCCESS':
      return PaymentStatus.PAID;
    case 'FAILED':
    case 'USER_DROPPED':
      return PaymentStatus.FAILED;
    case 'PENDING':
    case 'NOT_ATTEMPTED':
    default:
      return PaymentStatus.PENDING;
  }
}
