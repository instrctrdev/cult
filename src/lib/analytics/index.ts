import { analyticsProviders } from './providers';
import type { AnalyticsEvent } from './events';

export type { AnalyticsEvent, AnalyticsItem } from './events';

/**
 * The single entry point every component uses.
 *
 * Fan-out is wrapped so a broken or blocked vendor script can never throw
 * inside a click handler and break an add-to-cart.
 */
export function track(event: AnalyticsEvent): void {
  if (typeof window === 'undefined') return;
  for (const provider of analyticsProviders) {
    try {
      if (provider.isEnabled()) provider.track(event);
    } catch (err) {
      console.warn(`[analytics] ${provider.name} failed`, err);
    }
  }
}

/** Converts internal paise to the major-unit values vendors expect. */
export const rupees = (paise: number) => Math.round(paise) / 100;
