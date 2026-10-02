import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withErrorHandling, badRequest } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { AuditService } from '@/services/audit.service';
import { BulkImportService } from '@/services/bulk-import.service';
import { clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_ZIP_BYTES = 200 * 1024 * 1024;

/** The importer's own column order — the sheet is rebuilt in exactly this shape. */
const COLUMNS = [
  'name', 'slug', 'subtitle', 'description', 'fabric', 'fit',
  'price', 'compare_at_price', 'status', 'categories',
  'featured', 'new_arrival', 'best_seller', 'images', 'variants',
] as const;

const rowSchema = z.object(
  Object.fromEntries(COLUMNS.map((c) => [c, z.string().max(2000).default('')])) as Record<
    (typeof COLUMNS)[number],
    z.ZodDefault<z.ZodString>
  >,
);

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(200),
  dryRun: z.boolean().optional(),
});

/** RFC 4180: quote everything and double any embedded quote. */
function toCsv(rows: Record<string, string>[]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [
    COLUMNS.join(','),
    ...rows.map((r) => COLUMNS.map((c) => escape(r[c] ?? '')).join(',')),
  ].join('\n');
}

/**
 * POST /api/admin/ai/import/create — creates the products the admin confirmed.
 *
 * The rows arrive already prepared and reviewed, so this rebuilds them into
 * the sheet the existing bulk importer expects and hands off. Nothing about
 * how a product is created is reimplemented here: the same validation,
 * per-row transaction and error reporting apply as for an uploaded sheet,
 * whether the rows were typed into Excel or dictated to the assistant.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const actor = await requirePermission('products.write');

  const form = await req.formData();
  const payload = form.get('payload');
  if (typeof payload !== 'string') throw badRequest('Nothing to import.');

  const { rows, dryRun } = bodySchema.parse(JSON.parse(payload));

  const zipFile = form.get('images');
  if (zipFile instanceof File && zipFile.size > MAX_ZIP_BYTES) {
    throw badRequest('Image ZIP is too large (200MB max).');
  }
  const zipBuffer = zipFile instanceof File && zipFile.size > 0 ? Buffer.from(await zipFile.arrayBuffer()) : null;

  const summary = await BulkImportService.importProducts(
    Buffer.from(toCsv(rows), 'utf8'),
    false,
    zipBuffer,
    Boolean(dryRun),
  );

  if (!dryRun) {
    await AuditService.log({
      actorId: actor.id,
      action: 'ai.product_import',
      entityType: 'Product',
      entityId: 'bulk',
      changes: { after: { created: summary.created, failed: summary.failed } },
      ip: clientIp(req.headers),
    });
  }

  return NextResponse.json(summary);
});
