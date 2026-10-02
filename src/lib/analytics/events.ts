/**
 * Provider-agnostic analytics contract.
 *
 * Components emit these typed events and never reference GA, Meta Pixel or any
 * other vendor. Adding a provider is a change in one file (`providers.ts`).
 */
export interface AnalyticsItem {
  id: string;
  name: string;
  /** Rupees — analytics vendors expect major units, unlike our internal paise. */
  price: number;
  quantity?: number;
  variant?: string;
  category?: string;
}

export type AnalyticsEvent =
  | { name: 'page_view'; path: string; title?: string }
  | { name: 'view_item'; item: AnalyticsItem }
  | { name: 'view_item_list'; listName: string; items: AnalyticsItem[] }
  | { name: 'search'; term: string; results: number }
  | { name: 'add_to_cart'; item: AnalyticsItem; value: number }
  | { name: 'remove_from_cart'; item: AnalyticsItem; value: number }
  | { name: 'view_cart'; value: number; items: AnalyticsItem[] }
  | { name: 'begin_checkout'; value: number; items: AnalyticsItem[]; coupon?: string }
  | { name: 'add_payment_info'; value: number; paymentMethod: string }
  | { name: 'purchase'; orderNumber: string; value: number; shipping: number; tax: number; coupon?: string; items: AnalyticsItem[] }
  | { name: 'add_to_wishlist'; item: AnalyticsItem }
  | { name: 'select_coupon'; code: string; discount: number };

export interface AnalyticsProvider {
  readonly name: string;
  isEnabled(): boolean;
  track(event: AnalyticsEvent): void;
}
