import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling, badRequest } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { AuditService } from '@/services/audit.service';
import { BulkImportService } from '@/services/bulk-import.service';
import { clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
// Many products with images can take a while — well past the default
// route timeout on a small Node instance.
export const maxDuration = 120;

const MAX_SHEET_BYTES = 5 * 1024 * 1024;
const MAX_ZIP_BYTES = 200 * 1024 * 1024;
const EXCEL_EXTENSIONS = /\.xlsx?$/i;

/**
 * POST /api/admin/products/bulk-import — a CSV or Excel sheet (+ optional
 * ZIP of images), one row per product. Entirely separate from the
 * single-product create/edit routes; nothing here is reused by or shared
 * with them.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const actor = await requirePermission('products.write');

  const form = await req.formData();
  const sheetFile = form.get('csv');
  const zipFile = form.get('images');

  if (!(sheetFile instanceof File)) throw badRequest('A CSV or Excel file is required.');
  if (sheetFile.size > MAX_SHEET_BYTES) throw badRequest('File is too large.');
  if (zipFile instanceof File && zipFile.size > MAX_ZIP_BYTES) throw badRequest('Image ZIP is too large (200MB max).');

  const isExcel = EXCEL_EXTENSIONS.test(sheetFile.name) || sheetFile.type.includes('spreadsheetml');
  const sheetBuffer = Buffer.from(await sheetFile.arrayBuffer());
  const zipBuffer = zipFile instanceof File && zipFile.size > 0 ? Buffer.from(await zipFile.arrayBuffer()) : null;

  const summary = await BulkImportService.importProducts(sheetBuffer, isExcel, zipBuffer);

  await AuditService.log({
    actorId: actor.id,
    action: 'product.bulk_import',
    entityType: 'Product',
    entityId: 'bulk',
    changes: { after: { created: summary.created, failed: summary.failed } },
    ip: clientIp(req.headers),
  });

  return NextResponse.json(summary);
});
