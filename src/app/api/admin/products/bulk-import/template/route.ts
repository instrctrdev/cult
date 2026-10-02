import { NextResponse, type NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { withErrorHandling } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const HEADER = [
  'name', 'slug', 'subtitle', 'description', 'fabric', 'fit',
  'price', 'compare_at_price', 'status', 'categories',
  'featured', 'new_arrival', 'best_seller', 'images', 'variants',
];

const EXAMPLE = [
  'Charcoal Oxford Shirt', '', 'Everyday tailoring, relaxed', 'A crisp oxford weave that layers well.',
  'Cotton', 'Regular Fit', '999', '1499', 'draft', 'shirts,new-arrivals',
  'false', 'true', 'false', 'charcoal-1.jpg,charcoal-2.jpg', 'S:Black:10;M:Black:15;L:Black:8',
];

/**
 * GET /api/admin/products/bulk-import/template — a starter sheet with one
 * filled example row. `?format=xlsx` returns a real Excel workbook instead
 * of CSV; both have the identical column layout the importer expects.
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  await requirePermission('products.read');

  if (req.nextUrl.searchParams.get('format') === 'xlsx') {
    const sheet = XLSX.utils.aoa_to_sheet([HEADER, EXAMPLE]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Products');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="cult-bulk-import-template.xlsx"',
      },
    });
  }

  const csv = [HEADER, EXAMPLE]
    .map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(','))
    .join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="cult-bulk-import-template.csv"',
    },
  });
});
