import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { InventoryService } from '@/services/inventory.service';
import { AuditService } from '@/services/audit.service';
import { adminInventorySchema } from '@/lib/validation';
import { clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/inventory — sets an absolute on-hand quantity.
 *
 * The service writes an InventoryLedger row for every change, so stock never
 * moves without a recorded reason and actor.
 */
export const PATCH = withErrorHandling(async (req: NextRequest) => {
  const actor = await requirePermission('inventory.write');
  const { variantId, quantity, note } = adminInventorySchema.parse(await req.json());

  await InventoryService.adjust(variantId, quantity, actor.id, note);

  await AuditService.log({
    actorId: actor.id, action: 'inventory.adjust', entityType: 'ProductVariant',
    entityId: variantId, changes: { after: { quantity, note } }, ip: clientIp(req.headers),
  });

  return NextResponse.json({ ok: true });
});
