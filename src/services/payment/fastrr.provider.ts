import { createHmac } from 'crypto';
import { PaymentStatus } from '@prisma/client';
import { AppError } from '@/lib/errors';
import { env } from '@/lib/env';
import type {
  CreatePaymentInput, CreatePaymentResult, PaymentProvider,
  RefundRef, RefundResult, VerifyPaymentResult, WebhookResult,
} from './types';

/**
 * Fastrr (Shiprocket Checkout) — headless custom-platform integration.
 *
 * This implements Fastrr's own "Full checkout custom Integration APIs
 * [PUBLIC]" Postman collection, confirmed directly with Shiprocket support —
 * not the Shopify plugin bundle. Every path, field name and status value
 * below is taken from that spec.
 *
 * ── Base URLs ────────────────────────────────────────────────────────────
 *   staging     https://fastrr-api-dev.pickrr.com
 *   production  https://checkout-api.shiprocket.com
 *
 * ── Endpoints used ──────────────────────────────────────────────────────
 *   POST /api/v1/access-token/checkout                     create a checkout session
 *   POST /api/v1/custom-platform-order/details              authoritative order status
 *   POST /api/v1/custom-platform-order/details/transactions gateway-level transaction log
 *
 * There is **no refund endpoint** in this spec. `refundPayment` throws rather
 * than calling something invented — refunds go through the Fastrr dashboard,
 * or directly through the underlying gateway (Razorpay, per the transactions
 * response), until Shiprocket confirms otherwise.
 *
 * ── Auth ────────────────────────────────────────────────────────────────
 * Every request carries `X-Api-Key` and `X-Api-HMAC-SHA256` (HMAC-SHA256 of
 * the request, Base64-encoded, keyed with the API secret). The collection
 * points at a generic external HMAC calculator rather than documenting its
 * own canonicalisation, so the exact bytes hashed are not fully specified.
 * `sign()` below hashes the exact JSON string sent as the body — the
 * conventional choice — and is marked so it can be corrected in one place if
 * Shiprocket's answer differs.
 *
 * ── Settlement ──────────────────────────────────────────────────────────
 * The incoming `Order` webhook carries no signature at all in the published
 * spec (only `Content-Type: application/json`), and Fastrr's own docs warn it
 * "may be sent more than once" and recommend a periodic status check as a
 * failsafe. This provider therefore never trusts the webhook body for
 * settlement — receiving one only triggers a call to `verifyPayment`
 * (`custom-platform-order/details`), which is the one response this code
 * treats as authoritative.
 *
 * ── Browser handoff ─────────────────────────────────────────────────────
 * The `token` returned by `createPayment` is passed to
 * `HeadlessCheckout.addToCart(event, token)` in the browser — see
 * `src/lib/fastrr/sdk.ts`. On completion the customer is redirected to
 * `returnUrl?oid=<order_id>&ost=SUCCESS|FAILED`; that redirect is a UX
 * courtesy only and is never used to settle anything.
 */

function endpoints() {
  const e = env();
  const base = e.PAYMENT_BASE_URL.replace(/\/$/, '');
  return {
    createCheckout: `${base}${e.FASTRR_PATH_CREATE}`,
    orderDetails: `${base}${e.FASTRR_PATH_STATUS}`,
    transactions: `${base}${e.FASTRR_PATH_TRANSACTIONS}`,
  };
}

/** Fastrr's `status` values on custom-platform-order/details. */
type FastrrOrderStatus = 'CREATED' | 'INITIATED' | 'FAILED' | 'SUCCESS';
/** Fastrr's `payment_status` values, distinct from the order-level status above. */
type FastrrPaymentStatus = 'Pending' | 'Success' | 'Failed';

interface FastrrOrderDetails {
  order_id: string;
  status: FastrrOrderStatus;
  payment_type: 'CASH_ON_DELIVERY' | 'PREPAID';
  payment_status: FastrrPaymentStatus;
  total_amount_payable: number;
  platform_order_id: string;
}

export class FastrrProvider implements PaymentProvider {
  readonly name = 'fastrr';

  private get config() {
    const e = env();
    return { apiKey: e.PAYMENT_API_KEY, secret: e.PAYMENT_SECRET };
  }

  isConfigured(): boolean {
    const { apiKey, secret } = this.config;
    return Boolean(apiKey && secret);
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new AppError('PAYMENT_ERROR', 'Online payment is temporarily unavailable.');
    }
  }

  /**
   * HMAC-SHA256 of the request body, Base64-encoded, keyed with the API
   * secret — exactly as documented. The one open question is *which bytes*:
   * this hashes the JSON string as it will be sent on the wire.
   */
  private sign(rawBody: string): string {
    return createHmac('sha256', this.config.secret).update(rawBody).digest('base64');
  }

  private async post<T>(url: string, body: Record<string, unknown>): Promise<T> {
    const raw = JSON.stringify(body);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.config.apiKey,
        'X-Api-HMAC-SHA256': this.sign(raw),
      },
      body: raw,
      cache: 'no-store',
    });

    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new AppError('PAYMENT_ERROR', 'Payment gateway returned an unreadable response.', { status: res.status });
    }

    if (!res.ok || (json as { ok?: boolean })?.ok === false) {
      console.error('[fastrr] request failed', { url, status: res.status, json });
      const message = (json as { error?: { message?: string } })?.error?.message;
      throw new AppError('PAYMENT_ERROR', message ?? 'We could not start the payment. Please try again.', {
        status: res.status,
      });
    }

    return json as T;
  }

  /**
   * POST /api/v1/access-token/checkout
   *
   * Body: `{ cart_data: { items: [{ variant_id, quantity }] }, redirect_url, timestamp }`.
   * Response carries a short-lived `token` (see `expires_at`) and Fastrr's own
   * `order_id`, which becomes our `providerOrderId` for every later lookup.
   */
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    this.assertConfigured();

    // `input.notifyUrl` is intentionally unused here: Fastrr's webhook target
    // is registered once, account-wide, in the merchant dashboard
    // (`<SELLER_REGISTERED_WEBHOOK_URL>` in their docs) — there is no
    // per-request field for it in this API.
    const res = await this.post<{
      ok: boolean;
      result: { token: string; expires_at: string; data: { order_id: string } };
    }>(endpoints().createCheckout, {
      cart_data: {
        items: input.lines.map((l) => ({ variant_id: l.variantId, quantity: l.quantity })),
      },
      redirect_url: input.returnUrl,
      timestamp: new Date().toISOString(),
      ...(input.couponCode ? { coupon_code: input.couponCode } : {}),
    });

    const providerOrderId = res.result?.data?.order_id;
    if (!providerOrderId) {
      throw new AppError('PAYMENT_ERROR', 'Payment gateway did not return an order reference.');
    }

    return {
      providerOrderId,
      // No hosted redirect URL in this API — the browser opens Fastrr's UI
      // in-page via the token. See src/lib/fastrr/sdk.ts.
      redirectUrl: undefined,
      clientConfig: { token: res.result.token, expiresAt: res.result.expires_at },
    };
  }

  /**
   * POST /api/v1/custom-platform-order/details
   *
   * The one response this integration treats as authoritative for settling a
   * payment — called directly on redirect-back, and again whenever the
   * (unsigned) webhook fires.
   */
  async verifyPayment(providerOrderId: string): Promise<VerifyPaymentResult> {
    this.assertConfigured();

    const res = await this.post<{ ok: boolean; result: FastrrOrderDetails }>(endpoints().orderDetails, {
      order_id: providerOrderId,
      timestamp: new Date().toISOString(),
    });

    const d = res.result;
    return {
      status: mapStatus(d.status, d.payment_status),
      // Fastrr's details response identifies the order, not a gateway payment
      // id — the per-transaction id is fetched separately when needed.
      providerPaymentId: d.platform_order_id ?? null,
      amountPaise: typeof d.total_amount_payable === 'number' ? Math.round(d.total_amount_payable * 100) : null,
      failureReason: d.status === 'FAILED' ? 'Payment failed at gateway.' : undefined,
      raw: res,
    };
  }

  /** POST /api/v1/custom-platform-order/details/transactions — gateway-level detail. */
  async fetchTransactions(providerOrderId: string) {
    this.assertConfigured();
    return this.post<{
      ok: boolean;
      result: {
        payments: Array<{
          txn_id: string;
          payment_status: FastrrPaymentStatus;
          gateway: string;
          payment_method: string;
          amount: number;
          pg_transaction_id: string;
          amount_received: number;
          created_at: string;
        }>;
      };
    }>(endpoints().transactions, { order_id: providerOrderId, timestamp: new Date().toISOString() });
  }

  /**
   * Incoming `Order` webhook.
   *
   * Fastrr's spec carries no signature on this request — only
   * `Content-Type: application/json` — and explicitly warns it may be sent
   * more than once. `signatureOk` is therefore always `false`: the caller
   * (`PaymentService`) never settles a payment on this payload alone, it uses
   * receipt of the webhook only as the trigger to call `verifyPayment`, which
   * *is* authenticated.
   */
  async parseWebhook(rawBody: string, _headers: Headers): Promise<WebhookResult> {
    let body: Partial<FastrrOrderDetails> & { order_id?: string };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return {
        externalId: null, eventType: 'unparseable', orderNumber: null, providerOrderId: null,
        status: null, providerPaymentId: null, amountPaise: null, signatureOk: false, raw: rawBody,
      };
    }

    return {
      // No event id in this payload; the order id plus its status is used as
      // the idempotency key one layer up.
      externalId: body.order_id && body.status ? `${body.order_id}:${body.status}` : null,
      eventType: 'order.status',
      orderNumber: null, // resolved by providerOrderId → Payment → Order in PaymentService
      providerOrderId: body.order_id ?? null,
      status: body.status ? mapStatus(body.status, body.payment_status ?? 'Pending') : null,
      providerPaymentId: body.platform_order_id ?? null,
      amountPaise: typeof body.total_amount_payable === 'number' ? Math.round(body.total_amount_payable * 100) : null,
      signatureOk: false,
      raw: body,
    };
  }

  /**
   * Fastrr's published API has no refund endpoint. Calling this is a bug in
   * the caller, not a transient failure — it throws rather than pretending to
   * refund. Process refunds via the Fastrr/Shiprocket dashboard, or directly
   * through the underlying gateway using the `pg_transaction_id` from
   * `fetchTransactions`, until Shiprocket confirms an API for this.
   */
  async refundPayment(_ref: RefundRef, _amountPaise: number, _reason?: string): Promise<RefundResult> {
    throw new AppError(
      'PAYMENT_ERROR',
      'Fastrr has no refund API in the current integration. Process this refund from the Shiprocket dashboard.',
    );
  }
}

/**
 * Fastrr separates the checkout's lifecycle `status` (CREATED / INITIATED /
 * FAILED / SUCCESS) from the gateway's `payment_status` (Pending / Success /
 * Failed). `status` is authoritative for whether the order itself completed.
 */
function mapStatus(status: FastrrOrderStatus, paymentStatus: FastrrPaymentStatus): PaymentStatus {
  if (status === 'SUCCESS' && paymentStatus === 'Success') return PaymentStatus.PAID;
  if (status === 'FAILED' || paymentStatus === 'Failed') return PaymentStatus.FAILED;
  if (status === 'INITIATED') return PaymentStatus.AUTHORIZED;
  return PaymentStatus.PENDING;
}
