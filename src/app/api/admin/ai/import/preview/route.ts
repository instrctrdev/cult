import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling, badRequest } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { BulkImportService } from '@/services/bulk-import.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_SHEET_BYTES = 5 * 1024 * 1024;
const MAX_ZIP_BYTES = 200 * 1024 * 1024;
const EXCEL_EXTENSIONS = /\.xlsx?$/i;

/**
 * Validates a spreadsheet the admin attached in the AI chat — same parsing
 * and row checks as the real bulk import, but `dryRun: true` so nothing is
 * written. The chat UI shows this summary as a confirmation card; only a
 * follow-up POST to /commit with the same file actually creates anything.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  await requirePermission('products.write');

  const form = await req.formData();
  const sheetFile = form.get('csv');
  const zipFile = form.get('images');

  if (!(sheetFile instanceof File)) throw badRequest('A CSV or Excel file is required.');
  if (sheetFile.size > MAX_SHEET_BYTES) throw badRequest('File is too large.');
  if (zipFile instanceof File && zipFile.size > MAX_ZIP_BYTES) throw badRequest('Image ZIP is too large (200MB max).');

  const isExcel = EXCEL_EXTENSIONS.test(sheetFile.name) || sheetFile.type.includes('spreadsheetml');
  const sheetBuffer = Buffer.from(await sheetFile.arrayBuffer());
  const zipBuffer = zipFile instanceof File && zipFile.size > 0 ? Buffer.from(await zipFile.arrayBuffer()) : null;

  const summary = await BulkImportService.importProducts(sheetBuffer, isExcel, zipBuffer, true);

  return NextResponse.json(summary);
});
