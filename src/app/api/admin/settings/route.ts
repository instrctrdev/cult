import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { getSettings, setSettings, SETTING_DEFAULTS, type SettingKey } from '@/lib/settings';
import { AuditService } from '@/services/audit.service';
import { adminSettingsSchema } from '@/lib/validation';
import { clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async () => {
  await requirePermission('settings.read');
  return NextResponse.json({ settings: await getSettings() });
});

/**
 * PATCH — updates commerce rules (shipping fee, free-shipping threshold, COD
 * fee, handling). Unknown keys are ignored rather than stored, so the settings
 * table cannot be used as arbitrary storage.
 */
export const PATCH = withErrorHandling(async (req: NextRequest) => {
  const actor = await requirePermission('settings.write');
  const body = adminSettingsSchema.parse(await req.json());

  // Unknown keys are dropped rather than stored, so the settings table cannot
  // be used as arbitrary storage.
  const accepted = Object.entries(body).filter(([key]) => key in SETTING_DEFAULTS) as [
    SettingKey,
    string | number | boolean,
  ][];

  // One batched transaction, not one round trip per field — see setSettings.
  await setSettings(accepted);

  const applied = Object.fromEntries(accepted);

  await AuditService.log({
    actorId: actor.id, action: 'settings.update', entityType: 'Setting',
    changes: { after: applied }, ip: clientIp(req.headers),
  });

  return NextResponse.json({ ok: true, applied });
});
