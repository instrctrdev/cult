import { NextResponse, type NextRequest } from 'next/server';
import AdmZip from 'adm-zip';
import { withErrorHandling, badRequest } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const MAX_ZIP_BYTES = 200 * 1024 * 1024;
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|avif)$/i;

/**
 * POST /api/admin/ai/import/inspect — lists the image filenames in a ZIP.
 *
 * Only the names leave this route. The model has no way to see a photograph,
 * so a file is only ever matched to a product by what its name says, and the
 * admin confirms that mapping before anything is created.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  await requirePermission('products.write');

  const form = await req.formData();
  const zipFile = form.get('images');
  if (!(zipFile instanceof File)) throw badRequest('A ZIP of images is required.');
  if (zipFile.size > MAX_ZIP_BYTES) throw badRequest('Image ZIP is too large (200MB max).');

  const zip = new AdmZip(Buffer.from(await zipFile.arrayBuffer()));
  const files = zip
    .getEntries()
    .filter((e) => !e.isDirectory)
    // Flattened to the bare filename, which is what the importer matches on.
    .map((e) => e.entryName.split('/').pop() ?? '')
    .filter((n) => n && !n.startsWith('.') && IMAGE_EXTENSIONS.test(n));

  return NextResponse.json({ files });
});
