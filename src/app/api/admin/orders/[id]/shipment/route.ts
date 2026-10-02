import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ShipmentStatus } from '@prisma/client';
import { withErrorHandling } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { ShippingService } from '@/services/shipping.service';
import { AuditService } from '@/services/audit.service';
import { clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const shipmentSchema = z.object({
  courierName: z.string().trim().max(150).optional().nullable(),
  awbCode: z.string().trim().max(100).optional().nullable(),
  trackingUrl: z.string().trim().max(512).url('Enter a valid tracking URL.').optional().nullable().or(z.literal('')),
  expectedDelivery: z.coerce.date().optional().nullable(),
  status: z.nativeEnum(ShipmentStatus).optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

/**
 * PUT /api/admin/orders/[id]/shipment
 *
 * Records manually-entered tracking details. There is no carrier API call —
 * fulfilment happens outside the system and staff key in what the courier gave
 * them. Saving also advances the order status and appends to the customer's
 * visible timeline.
 */
export const PUT = withErrorHandling(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requirePermission('orders.write');
  const { id } = await ctx.params;

  const body = shipmentSchema.parse(await req.json());

  const shipment = await ShippingService.saveManualShipment(
    id,
    { ...body, trackingUrl: body.trackingUrl || null },
    actor.id,
  );

  await AuditService.log({
    actorId: actor.id,
    action: 'shipment.save',
    entityType: 'Order',
    entityId: id,
    changes: { after: body },
    ip: clientIp(req.headers),
    userAgent: req.headers.get('user-agent'),
  });

  return NextResponse.json({ shipment });
});

/** DELETE — marks the shipment cancelled (the order itself is untouched). */
export const DELETE = withErrorHandling(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requirePermission('orders.write');
  const { id } = await ctx.params;

  const shipment = await ShippingService.getForOrder(id);
  if (shipment) await ShippingService.cancelShipment(shipment.id, actor.id);

  await AuditService.log({
    actorId: actor.id,
    action: 'shipment.cancel',
    entityType: 'Order',
    entityId: id,
    ip: clientIp(req.headers),
  });

  return NextResponse.json({ ok: true });
});
