import { ManualShippingProvider } from './manual.provider';
import type { ShippingProvider } from './types';

export type * from './types';

let provider: ShippingProvider | null = null;

/**
 * Resolves the active shipping provider.
 *
 * Today this is always the manual provider. When a carrier API is added, its
 * class is registered here behind `SHIPPING_PROVIDER` and nothing else in the
 * codebase changes:
 *
 *   switch (process.env.SHIPPING_PROVIDER) {
 *     case 'shiprocket': return new ShiprocketProvider();
 *     default:           return new ManualShippingProvider();
 *   }
 */
export function shippingProvider(): ShippingProvider {
  if (provider) return provider;
  provider = new ManualShippingProvider();
  return provider;
}
