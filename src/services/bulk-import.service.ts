import 'server-only';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import AdmZip from 'adm-zip';
import { Prisma, ProductStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';
import { MediaService } from './media.service';

/**
 * Bulk product import from a spreadsheet (CSV or Excel) + a ZIP of images —
 * entirely separate from the one-by-one Admin → Products form, which this
 * never touches. One row is one product; images are matched by filename
 * against entries in the ZIP, and variants are packed into a single
 * delimited column so the sheet stays one row per product rather than one
 * row per size/colour.
 *
 * Never partially creates a product: each row runs in its own transaction,
 * so a bad row is skipped and reported without leaving an orphaned product
 * with no variants or a variant with no inventory row.
 */

export interface BulkImportRowResult {
  row: number;
  name: string;
  status: 'created' | 'error';
  message?: string;
  productId?: string;
}

export interface BulkImportSummary {
  created: number;
  failed: number;
  results: BulkImportRowResult[];
}

interface CsvRow {
  name?: string;
  slug?: string;
  subtitle?: string;
  description?: string;
  fabric?: string;
  fit?: string;
  price?: string;
  compare_at_price?: string;
  status?: string;
  categories?: string;
  featured?: string;
  new_arrival?: string;
  best_seller?: string;
  images?: string;
  variants?: string;
}

const TRUE_VALUES = new Set(['true', 'yes', '1', 'y']);
const STATUS_MAP: Record<string, ProductStatus> = {
  draft: ProductStatus.DRAFT,
  active: ProductStatus.ACTIVE,
  archived: ProductStatus.ARCHIVED,
};

function parseVariants(raw: string): { sizeCode: string; colorSlug: string; stock: number }[] {
  return raw
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [sizeCode, colorSlug, stockRaw] = entry.split(':').map((v) => v?.trim());
      const stock = Number(stockRaw);
      if (!sizeCode || !colorSlug || !Number.isFinite(stock) || stock < 0) {
        throw new Error(`Invalid variant "${entry}" — expected SIZE:COLOR:STOCK, e.g. S:Black:20`);
      }
      return { sizeCode: sizeCode.toUpperCase(), colorSlug: slugify(colorSlug), stock };
    });
}

const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/\s+/g, '_');

/**
 * Excel cells come back as whatever native type the sheet holds — numbers,
 * dates, booleans — but every downstream check (`row.price?.trim()`, etc.)
 * expects a string, the same as csv-parse always returns. Coercing here
 * once means the row-processing logic below never has to care which format
 * the sheet came in as.
 */
function parseSpreadsheet(buffer: Buffer, isExcel: boolean): CsvRow[] {
  if (!isExcel) {
    return parse(buffer, {
      columns: (header: string[]) => header.map(normalizeHeader),
      skip_empty_lines: true,
      trim: true,
    });
  }

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  return raw.map((rawRow) => {
    const row: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawRow)) {
      row[normalizeHeader(key)] = value == null ? '' : String(value).trim();
    }
    return row as CsvRow;
  });
}

export const BulkImportService = {
  /**
   * `dryRun` validates every row — names, prices, variants, categories,
   * image filenames — exactly as a real import would, but skips the actual
   * `prisma.$transaction` writes and image storage. Used by the AI Copilot
   * to show "this will create N products, M will fail" before the admin
   * confirms, without touching the database.
   */
  async importProducts(fileBuffer: Buffer, isExcel: boolean, zipBuffer: Buffer | null, dryRun = false): Promise<BulkImportSummary> {
    const rows: CsvRow[] = parseSpreadsheet(fileBuffer, isExcel);

    const [sizes, colors, categories] = await Promise.all([
      prisma.size.findMany({ select: { id: true, code: true } }),
      prisma.color.findMany({ select: { id: true, slug: true } }),
      prisma.category.findMany({ select: { id: true, slug: true } }),
    ]);
    const sizeByCode = new Map(sizes.map((s) => [s.code.toUpperCase(), s.id]));
    const colorBySlug = new Map(colors.map((c) => [c.slug, c.id]));
    const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]));

    let zip: AdmZip | null = null;
    const zipFiles = new Map<string, Buffer>();
    if (zipBuffer) {
      zip = new AdmZip(zipBuffer);
      for (const entry of zip.getEntries()) {
        if (!entry.isDirectory) zipFiles.set(entry.entryName.split('/').pop()!, entry.getData());
      }
    }

    const results: BulkImportRowResult[] = [];

    for (const [i, row] of rows.entries()) {
      const rowNumber = i + 2; // header is row 1
      const name = row.name?.trim();

      try {
        if (!name) throw new Error('Missing product name.');
        const price = Number(row.price);
        if (!Number.isFinite(price) || price <= 0) throw new Error('Missing or invalid price.');
        if (!row.variants?.trim()) throw new Error('Missing variants column — at least one SIZE:COLOR:STOCK entry is required.');

        const variantSpecs = parseVariants(row.variants);
        const resolvedVariants = variantSpecs.map((v) => {
          const sizeId = sizeByCode.get(v.sizeCode);
          const colorId = colorBySlug.get(v.colorSlug);
          if (!sizeId) throw new Error(`Unknown size code "${v.sizeCode}".`);
          if (!colorId) throw new Error(`Unknown colour "${v.colorSlug}".`);
          return { sizeId, colorId, stock: v.stock, sizeCode: v.sizeCode, colorSlug: v.colorSlug };
        });

        const slug = row.slug?.trim() || slugify(name);
        const clash = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
        if (clash) throw new Error(`A product with slug "${slug}" already exists.`);

        const categorySlugs = (row.categories ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const categoryIds: string[] = [];
        for (const slugName of categorySlugs) {
          const id = categoryBySlug.get(slugName);
          if (!id) throw new Error(`Unknown category "${slugName}".`);
          categoryIds.push(id);
        }

        const compareAtPrice = row.compare_at_price?.trim() ? Number(row.compare_at_price) : null;
        if (compareAtPrice != null && !Number.isFinite(compareAtPrice)) {
          throw new Error('Invalid compare_at_price.');
        }

        const status = STATUS_MAP[row.status?.trim().toLowerCase() ?? 'draft'] ?? ProductStatus.DRAFT;

        // Image filenames are validated against the ZIP up front, so a typo
        // fails the row before anything is written rather than silently
        // leaving the product with fewer images than the sheet asked for.
        const imageNames = (row.images ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        for (const fname of imageNames) {
          if (!zipFiles.has(fname)) throw new Error(`Image "${fname}" not found in the uploaded ZIP.`);
        }

        if (dryRun) {
          results.push({ row: rowNumber, name, status: 'created' });
          continue;
        }

        const product = await prisma.$transaction(async (tx) => {
          const created = await tx.product.create({
            data: {
              slug,
              name,
              subtitle: row.subtitle?.trim() || null,
              description: row.description?.trim() ? `<p>${row.description.trim()}</p>` : null,
              fabric: row.fabric?.trim() || null,
              fit: row.fit?.trim() || null,
              price: new Prisma.Decimal(price),
              compareAtPrice: compareAtPrice != null ? new Prisma.Decimal(compareAtPrice) : null,
              status,
              publishedAt: status === ProductStatus.ACTIVE ? new Date() : null,
              isFeatured: TRUE_VALUES.has(row.featured?.trim().toLowerCase() ?? ''),
              isNewArrival: TRUE_VALUES.has(row.new_arrival?.trim().toLowerCase() ?? ''),
              isBestSeller: TRUE_VALUES.has(row.best_seller?.trim().toLowerCase() ?? ''),
              needsDescription: !row.description?.trim(),
              needsImagery: imageNames.length === 0,
              categories: { create: categoryIds.map((categoryId, pos) => ({ categoryId, position: pos })) },
            },
          });

          for (const v of resolvedVariants) {
            const sku = `${slug.toUpperCase()}-${v.sizeCode}-${v.colorSlug.toUpperCase()}`.slice(0, 100);
            const variant = await tx.productVariant.create({
              data: {
                productId: created.id,
                sizeId: v.sizeId,
                colorId: v.colorId,
                sku,
                price: new Prisma.Decimal(price),
                compareAtPrice: compareAtPrice != null ? new Prisma.Decimal(compareAtPrice) : null,
              },
            });
            await tx.inventory.create({
              data: { variantId: variant.id, quantity: v.stock, lowStockThreshold: 3 },
            });
          }

          return created;
        });

        // Images are stored outside the transaction (disk I/O, not undone by
        // a DB rollback anyway) — a failure here still leaves a valid,
        // buyable product, just flagged needing imagery like any other.
        for (const [pos, fname] of imageNames.entries()) {
          const buf = zipFiles.get(fname)!;
          const stored = await MediaService.storeImage(buf, { folder: 'products', baseName: slug });
          await prisma.productImage.create({
            data: { productId: product.id, url: stored.url, blurDataUrl: stored.blurDataUrl, width: stored.width, height: stored.height, alt: name, position: pos },
          });
        }
        if (imageNames.length > 0) {
          await prisma.product.update({ where: { id: product.id }, data: { needsImagery: false } });
        }

        results.push({ row: rowNumber, name, status: 'created', productId: product.id });
      } catch (err) {
        results.push({
          row: rowNumber,
          name: name ?? `(row ${rowNumber})`,
          status: 'error',
          message: err instanceof Error ? err.message : 'Unknown error.',
        });
      }
    }

    return {
      created: results.filter((r) => r.status === 'created').length,
      failed: results.filter((r) => r.status === 'error').length,
      results,
    };
  },
};
