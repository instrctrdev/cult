import type { ShipmentStatus } from '@prisma/client';

/**
 * Shipping provider contract — the seam for a future carrier API.
 *
 * Nothing in the application calls a carrier today: shipments are created and
 * updated by staff in the admin panel. This interface exists so that adding
 * Shiprocket, Delhivery or any other provider later is a new file plus an env
 * var, with no change to OrderService, the admin screens or the database.
 */
export interface CreateShipmentInput {
  orderId: string;
  orderNumber: string;
  weightGrams: number;
  declaredValuePaise: number;
  cod: boolean;
  address: {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  items: { name: string; sku: string; quantity: number; unitPricePaise: number }[];
}

export interface CreateShipmentResult {
  providerOrderId: string | null;
  providerShipmentId: string | null;
  awbCode: string | null;
  courierName: string | null;
  trackingUrl: string | null;
}

export interface TrackResult {
  status: ShipmentStatus;
  courierName: string | null;
  trackingUrl: string | null;
  expectedDelivery: Date | null;
  deliveredAt: Date | null;
  raw: unknown;
}

export interface ShippingProvider {
  readonly name: string;
  /** False for the manual provider — the UI then shows manual entry fields. */
  isAutomated(): boolean;
  createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult>;
  track(awbCode: string): Promise<TrackResult>;
  cancel(providerOrderId: string): Promise<void>;
}
