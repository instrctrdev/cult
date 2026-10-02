import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling, badRequest } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { MediaService } from '@/services/media.service';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/admin/media — uploads an image to Hostinger's filesystem.
 *
 * The file is validated by magic number (not by its declared Content-Type),
 * re-encoded to WebP and written with responsive derivatives. Only the
 * resulting path is returned; binary data never touches MySQL.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const actor = await requirePermission('media.write');

  const form = await req.formData().catch(() => null);
  if (!form) throw badRequest('Expected a multipart form upload.');

  const file = form.get('file');
  if (!(file instanceof File)) throw badRequest('No file was provided.');

  const maxBytes = env().MAX_UPLOAD_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw badRequest(`Image must be ${env().MAX_UPLOAD_MB}MB or smaller.`);
  }

  const folder = String(form.get('folder') ?? 'products');
  const baseName = String(form.get('name') ?? file.name.replace(/\.[^.]+$/, ''));

  const stored = await MediaService.storeImage(Buffer.from(await file.arrayBuffer()), {
    folder,
    baseName,
  });

  return NextResponse.json({ ...stored, uploadedBy: actor.id }, { status: 201 });
});
