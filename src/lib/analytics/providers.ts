import { publicEnv } from '@/lib/env';
import type { AnalyticsEvent, AnalyticsProvider } from './events';

type Gtag = (command: string, ...args: unknown[]) => void;
type Fbq = (command: string, ...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: Gtag;
    dataLayer?: unknown[];
    fbq?: Fbq;
  }
}

/**
 * Google Analytics 4. Inert unless NEXT_PUBLIC_GA_MEASUREMENT_ID is set, so
 * the store ships with no third-party tracking by default.
 */
class GoogleAnalyticsProvider implements AnalyticsProvider {
  readonly name = 'ga4';

  isEnabled() {
    return Boolean(publicEnv.NEXT_PUBLIC_GA_MEASUREMENT_ID) && typeof window !== 'undefined' && typeof window.gtag === 'function';
  }

  track(event: AnalyticsEvent) {
    if (!this.isEnabled()) return;
    const gtag = window.gtag!;

    switch (event.name) {
      case 'page_view':
        gtag('event', 'page_view', { page_path: event.path, page_title: event.title });
        break;
      case 'view_item':
        gtag('event', 'view_item', { currency: 'INR', value: event.item.price, items: [toGaItem(event.item)] });
        break;
      case 'view_item_list':
        gtag('event', 'view_item_list', { item_list_name: event.listName, items: event.items.map(toGaItem) });
        break;
      case 'search':
        gtag('event', 'search', { search_term: event.term });
        break;
      case 'add_to_cart':
      case 'remove_from_cart':
        gtag('event', event.name, { currency: 'INR', value: event.value, items: [toGaItem(event.item)] });
        break;
      case 'view_cart':
      case 'begin_checkout':
        gtag('event', event.name, {
          currency: 'INR',
          value: event.value,
          items: event.items.map(toGaItem),
          ...(event.name === 'begin_checkout' && event.coupon ? { coupon: event.coupon } : {}),
        });
        break;
      case 'add_payment_info':
        gtag('event', 'add_payment_info', { currency: 'INR', value: event.value, payment_type: event.paymentMethod });
        break;
      case 'purchase':
        gtag('event', 'purchase', {
          transaction_id: event.orderNumber,
          currency: 'INR',
          value: event.value,
          shipping: event.shipping,
          tax: event.tax,
          coupon: event.coupon,
          items: event.items.map(toGaItem),
        });
        break;
      case 'add_to_wishlist':
        gtag('event', 'add_to_wishlist', { currency: 'INR', value: event.item.price, items: [toGaItem(event.item)] });
        break;
      case 'select_coupon':
        gtag('event', 'select_promotion', { promotion_name: event.code, value: event.discount });
        break;
    }
  }
}

/** Meta Pixel. Equally inert without NEXT_PUBLIC_META_PIXEL_ID. */
class MetaPixelProvider implements AnalyticsProvider {
  readonly name = 'meta';

  isEnabled() {
    return Boolean(publicEnv.NEXT_PUBLIC_META_PIXEL_ID) && typeof window !== 'undefined' && typeof window.fbq === 'function';
  }

  track(event: AnalyticsEvent) {
    if (!this.isEnabled()) return;
    const fbq = window.fbq!;

    switch (event.name) {
      case 'view_item':
        fbq('track', 'ViewContent', {
          content_ids: [event.item.id],
          contents: [toMetaContent(event.item)],
          content_name: event.item.name,
          content_type: 'product',
          value: event.item.price,
          currency: 'INR',
        });
        break;
      case 'search':
        fbq('track', 'Search', { search_string: event.term });
        break;
      case 'add_to_cart':
        fbq('track', 'AddToCart', {
          content_ids: [event.item.id],
          contents: [toMetaContent(event.item)],
          content_type: 'product',
          value: event.value,
          currency: 'INR',
        });
        break;
      case 'add_to_wishlist':
        fbq('track', 'AddToWishlist', {
          content_ids: [event.item.id],
          contents: [toMetaContent(event.item)],
          content_type: 'product',
          value: event.item.price,
          currency: 'INR',
        });
        break;
      case 'begin_checkout':
        fbq('track', 'InitiateCheckout', {
          value: event.value,
          currency: 'INR',
          content_ids: event.items.map((item) => item.id),
          contents: event.items.map(toMetaContent),
          content_type: 'product',
          num_items: event.items.reduce((total, item) => total + (item.quantity ?? 1), 0),
        });
        break;
      case 'add_payment_info':
        fbq('track', 'AddPaymentInfo', { value: event.value, currency: 'INR' });
        break;
      case 'purchase':
        // The order number is also sent as `event_id` by the Conversions API,
        // and Meta collapses the pair into one conversion. Without it the
        // server copy and this one would both be counted.
        fbq(
          'track',
          'Purchase',
          {
            value: event.value,
            currency: 'INR',
            content_ids: event.items.map((i) => i.id),
            contents: event.items.map(toMetaContent),
            content_type: 'product',
            num_items: event.items.reduce((total, item) => total + (item.quantity ?? 1), 0),
          },
          { eventID: event.orderNumber },
        );
        break;
      default:
        break;
    }
  }
}

function toMetaContent(item: { id: string; price: number; quantity?: number }) {
  return { id: item.id, item_price: item.price, quantity: item.quantity ?? 1 };
}

/** Development sink so events are verifiable without any vendor configured. */
class ConsoleProvider implements AnalyticsProvider {
  readonly name = 'console';
  isEnabled() {
    return process.env.NODE_ENV === 'development';
  }
  track(event: AnalyticsEvent) {
    if (this.isEnabled()) console.debug('[analytics]', event.name, event);
  }
}

function toGaItem(item: { id: string; name: string; price: number; quantity?: number; variant?: string; category?: string }) {
  return {
    item_id: item.id,
    item_name: item.name,
    price: item.price,
    quantity: item.quantity ?? 1,
    item_variant: item.variant,
    item_category: item.category,
  };
}

export const analyticsProviders: AnalyticsProvider[] = [
  new GoogleAnalyticsProvider(),
  new MetaPixelProvider(),
  new ConsoleProvider(),
];
