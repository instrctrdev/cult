import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { HomepageService } from '@/services/homepage.service';
import { AuditService } from '@/services/audit.service';
import { adminHomepageReorderSchema } from '@/lib/validation';
import { clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** PATCH /api/admin/homepage/reorder — persists a drag-and-drop reorder. */
export const PATCH = withErrorHandling(async (req: NextRequest) => {
  const actor = await requirePermission('banners.write');
  const { order } = adminHomepageReorderSchema.parse(await req.json());

  await HomepageService.reorder(order);

  await AuditService.log({
    actorId: actor.id, action: 'homepage.reorder', entityType: 'HomepageSection',
    changes: { after: { order } }, ip: clientIp(req.headers),
  });

  return NextResponse.json({ ok: true });
});
