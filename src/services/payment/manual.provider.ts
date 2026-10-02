import { PaymentStatus } from '@prisma/client';
import { AppError } from '@/lib/errors';
import type {
  CreatePaymentInput, CreatePaymentResult, PaymentProvider,
  RefundRef, RefundResult, VerifyPaymentResult, WebhookResult,
} from './types';

/**
 * Fallback provider used when no gateway credentials are configured.
 *
 * It deliberately does NOT simulate a successful payment: prepaid orders stay
 * PENDING until a human confirms them in the admin panel. This keeps local and
 * staging environments honest — there is no code path anywhere in this app
 * that marks money as received without a real provider confirming it.
 */
export class ManualProvider implements PaymentProvider {
  readonly name = 'manual';

  isConfigured(): boolean {
    return true;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return {
      providerOrderId: `manual_${input.orderNumber}`,
      redirectUrl: undefined,
      clientConfig: { manual: true, message: 'Awaiting manual payment confirmation.' },
    };
  }

  async verifyPayment(providerOrderId: string): Promise<VerifyPaymentResult> {
    return {
      status: PaymentStatus.PENDING,
      providerPaymentId: null,
      amountPaise: null,
      failureReason: 'No payment gateway configured; awaiting manual confirmation.',
      raw: { providerOrderId },
    };
  }

  async parseWebhook(): Promise<WebhookResult> {
    throw new AppError('PAYMENT_ERROR', 'No payment gateway is configured for webhooks.');
  }

  async refundPayment(_ref: RefundRef, amountPaise: number): Promise<RefundResult> {
    // Recorded so the admin can reconcile a refund made outside the system.
    return {
      providerRefundId: null,
      status: PaymentStatus.REFUND_PENDING,
      refundedPaise: amountPaise,
      raw: { manual: true },
    };
  }
}
