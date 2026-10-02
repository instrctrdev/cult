import 'server-only';
import { createHash } from 'crypto';
import { env, publicEnv } from '@/lib/env';
import { toRupees } from '@/lib/money';
import { isPlaceholder } from '@/lib/checkout/placeholders';

const GRAPH_VERSION = 'v21.0';

/** Meta requires personal identifiers hashed, never sent in the clear. */
function hash(value: string | null | undefined): string | undefined {
  const normalised = (value ?? '').trim().toLowerCase();
  if (!normalised) return undefined;
  return createHash('sha256').update(normalised).digest('hex');
}

/** Digits with country code, no punctuation — what Meta expects before hashing. */
function hashPhone(raw: string | null | undefined): string | undefined {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return undefined;
  const withCode = digits.length === 10 ? `91${digits}` : digits;
  return createHash('sha256').update(withCode).digest('hex');
}

export interface PurchaseEvent {
  /** Must match the browser pixel's `eventID` exactly, or Meta counts the sale twice. */
  eventId: string;
  valuePaise: number;
  contentIds: string[];
  numItems: number;
  contents?: { id: string; quantity: number }[];
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  /** From the customer's request when one is available; improves match quality. */
  clientIp?: string | null;
  userAgent?: string | null;
  eventSourceUrl?: string | null;
  occurredAt?: Date;
}

/**
 * Meta Conversions API — the server's own copy of a conversion.
 *
 * A meaningful share of shoppers block the browser pixel, and in India that is
 * commonly a fifth to a third of traffic. Those sales are invisible to ad
 * optimisation, which then bids as though the campaign is performing worse
 * than it is. Sending the purchase from the server closes that gap, because
 * nothing on the customer's device can stop it.
 *
 * Deduplication is the whole game: the browser sends `eventID` and this sends
 * `event_id`, both set to the order number. Meta collapses the pair into one
 * conversion. Get that wrong and every sale is counted twice, which is worse
 * than not sending at all.
 *
 * Never throws. A settled order must never fail because an analytics call did.
 */
export const MetaCapiService = {
  isConfigured(): boolean {
    return Boolean(env().META_CAPI_ACCESS_TOKEN && publicEnv.NEXT_PUBLIC_META_PIXEL_ID);
  },

  async sendPurchase(event: PurchaseEvent): Promise<{ sent: boolean; reason?: string }> {
    const token = env().META_CAPI_ACCESS_TOKEN;
    // Several pixel ids may be configured; the conversion belongs to the first,
    // which is the account the campaigns actually optimise against.
    const datasetId = publicEnv.NEXT_PUBLIC_META_PIXEL_ID.split(',')[0]?.trim();

    if (!token || !datasetId) return { sent: false, reason: 'Conversions API is not configured.' };

    // Placeholder contact details are worse than none: hashing them would tell
    // Meta these customers are all the same person.
    const email = isPlaceholder(event.email) ? undefined : hash(event.email);
    const phone = hashPhone(event.phone);

    const userData: Record<string, unknown> = {
      ...(email ? { em: [email] } : {}),
      ...(phone ? { ph: [phone] } : {}),
      ...(event.city ? { ct: [hash(event.city)] } : {}),
      ...(event.state ? { st: [hash(event.state)] } : {}),
      ...(event.pincode ? { zp: [hash(event.pincode)] } : {}),
      country: [hash('in')],
      ...(event.clientIp ? { client_ip_address: event.clientIp } : {}),
      ...(event.userAgent ? { client_user_agent: event.userAgent } : {}),
    };

    const body = {
      data: [
        {
          event_name: 'Purchase',
          event_time: Math.floor((event.occurredAt ?? new Date()).getTime() / 1000),
          event_id: event.eventId,
          action_source: 'website',
          ...(event.eventSourceUrl ? { event_source_url: event.eventSourceUrl } : {}),
          user_data: userData,
          custom_data: {
            currency: 'INR',
            value: toRupees(event.valuePaise),
            content_type: 'product',
            content_ids: event.contentIds,
            contents: event.contents ?? event.contentIds.map((id) => ({ id, quantity: 1 })),
            num_items: event.numItems,
          },
        },
      ],
      ...(env().META_CAPI_TEST_EVENT_CODE ? { test_event_code: env().META_CAPI_TEST_EVENT_CODE } : {}),
    };

    try {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${datasetId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        cache: 'no-store',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        // Never log the token, only what went wrong.
        console.error('[meta-capi] purchase rejected', {
          status: res.status,
          error: detail?.error?.message,
          eventId: event.eventId,
        });
        return { sent: false, reason: detail?.error?.message ?? `HTTP ${res.status}` };
      }

      return { sent: true };
    } catch (err) {
      console.error('[meta-capi] purchase failed to send', { eventId: event.eventId }, err);
      return { sent: false, reason: err instanceof Error ? err.message : 'request failed' };
    }
  },
};
