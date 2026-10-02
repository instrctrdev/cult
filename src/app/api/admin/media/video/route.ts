import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling, badRequest } from '@/lib/errors';
import { requirePermission } from '@/lib/auth/session';
import { MediaService } from '@/services/media.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** Clips take longer to receive and write than a still does. */
export const maxDuration = 120;

/**
 * POST /api/admin/media/video — uploads a clip to Hostinger's filesystem.
 *
 * Separate from the image route because nothing here is re-encoded: the file
 * is validated by magic number and written exactly as uploaded. Only the
 * resulting path is returned; binary data never touches MySQL.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const actor = await requirePermission('media.write');

  const form = await req.formData().catch(() => null);
  if (!form) throw badRequest('Expected a multipart form upload.');

  const file = form.get('file');
  if (!(file instanceof File)) throw badRequest('No file was provided.');

  // Checked before reading the body into memory, so an oversized upload is
  // rejected rather than buffered.
  const maxBytes = MediaService.maxVideoBytes();
  if (file.size > maxBytes) {
    throw badRequest(`Video must be ${Math.round(maxBytes / 1048576)}MB or smaller.`);
  }

  const folder = String(form.get('folder') ?? 'videos');
  const baseName = String(form.get('name') ?? file.name.replace(/\.[^.]+$/, ''));

  const stored = await MediaService.storeVideo(Buffer.from(await file.arrayBuffer()), { folder, baseName });

  return NextResponse.json({ ...stored, uploadedBy: actor.id }, { status: 201 });
});
