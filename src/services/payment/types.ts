import type { PaymentStatus } from '@prisma/client';

export interface CreatePaymentLine {
  /** Fastrr's `variant_id` — we send our internal variant id. */
  variantId: string;
  quantity: number;
  /** Shown in Cashfree's own order summary during One Click Checkout. */
  name: string;
  unitPricePaise: number;
}

export interface CreatePaymentInput {
  orderId: string;
  orderNumber: string;
  amountPaise: number;
  currency: string;
  customer: { name: string; email: string; phone: string };
  lines: CreatePaymentLine[];
  couponCode?: string | null;
  /** Where the provider should send the customer after payment. */
  returnUrl: string;
  notifyUrl: string;
}

export interface CreatePaymentResult {
  providerOrderId: string;
  /** Hosted checkout URL, when the provider redirects instead of embedding. */
  redirectUrl?: string;
  /** Opaque config handed to the provider's browser SDK. Never contains secrets. */
  clientConfig?: Record<string, unknown>;
}

export interface VerifyPaymentResult {
  status: PaymentStatus;
  providerPaymentId: string | null;
  amountPaise: number | null;
  failureReason?: string;
  /**
   * True when the gateway settled this as cash on delivery rather than a
   * real prepayment. Cashfree's One Click Checkout offers COD inside its own
   * sheet and then reports the order as `PAID` with `payment_group: "cash"` —
   * meaning "order confirmed", NOT "money received". Treating that as a
   * prepayment tells the admin they have been paid when the cash is still
   * due on delivery, so it is surfaced here and handled explicitly.
   */
  isCashOnDelivery?: boolean;
  /**
   * What the customer was actually charged, from the settled transaction.
   *
   * Not the same as `amountPaise`, which is the order total we asked for: a
   * gateway that applies its own shipping rules collects more than we sent,
   * and the order has to record what was really taken.
   */
  paidAmountPaise?: number | null;
  raw: unknown;
}

export interface WebhookResult {
  /** Provider event id, used to make replays idempotent. */
  externalId: string | null;
  eventType: string;
  orderNumber: string | null;
  providerOrderId: string | null;
  status: PaymentStatus | null;
  providerPaymentId: string | null;
  amountPaise: number | null;
  /** See `VerifyPaymentResult.isCashOnDelivery` — same meaning, from the event payload. */
  isCashOnDelivery?: boolean;
  signatureOk: boolean;
  raw: unknown;
}

export interface RefundResult {
  providerRefundId: string | null;
  status: PaymentStatus;
  refundedPaise: number;
  raw: unknown;
}

/**
 * Identifies the payment being refunded. Passed as an object rather than a
 * bare id because gateways disagree on what a refund is scoped to — Cashfree
 * refunds are addressed by *order* id (`POST /orders/{order_id}/refunds`),
 * while other gateways address a specific *payment/transaction* id. Both are
 * always available on our `Payment` row, so a provider just reads whichever
 * one its API needs.
 */
export interface RefundRef {
  providerOrderId: string | null;
  providerPaymentId: string | null;
}

/**
 * Contract every payment provider implements. The rest of the application
 * only ever talks to this interface, so swapping gateways is a one-file
 * change plus an env var.
 */
export interface PaymentProvider {
  readonly name: string;
  /** False when credentials are absent — the UI then hides prepaid. */
  isConfigured(): boolean;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyPayment(providerOrderId: string): Promise<VerifyPaymentResult>;
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookResult>;
  /** Throws if the provider has no refund endpoint — see the Fastrr provider for why. */
  refundPayment(ref: RefundRef, amountPaise: number, reason?: string): Promise<RefundResult>;
}
