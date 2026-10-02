import { AppError } from '@/lib/errors';
import type {
  CreateShipmentInput, CreateShipmentResult, ShippingProvider, TrackResult,
} from './types';

/**
 * The default provider: no carrier API at all.
 *
 * Fulfilment is handled outside the system, and staff record the courier name,
 * tracking number and expected delivery date in the admin panel. These methods
 * therefore refuse rather than pretending to talk to a carrier — a fake
 * "shipment created" would be worse than an honest error.
 */
export class ManualShippingProvider implements ShippingProvider {
  readonly name = 'manual';

  isAutomated(): boolean {
    return false;
  }

  async createShipment(_input: CreateShipmentInput): Promise<CreateShipmentResult> {
    throw new AppError(
      'SHIPPING_ERROR',
      'No carrier integration is configured. Add tracking details manually from the order screen.',
    );
  }

  async track(_awbCode: string): Promise<TrackResult> {
    throw new AppError('SHIPPING_ERROR', 'Automatic tracking is not available; status is updated manually.');
  }

  async cancel(_providerOrderId: string): Promise<void> {
    // Nothing to cancel with a carrier — the admin marks the shipment cancelled.
  }
}
