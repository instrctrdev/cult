import { NextResponse, type NextRequest } from 'next/server';
import { createReadStream } from 'fs';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { imageStoreConfig } from '@/lib/image-store';

export const dynamic = 'force-dynamic';

/**
 * Serves uploaded product/banner media from `UPLOAD_DIR`.
 *
 * Next's `output: 'standalone'` copies a fresh `public/` on every build, and
 * on Hostinger each deploy swaps in an entirely new build directory — so
 * anything written to `public/uploads` at runtime is gone on the next
 * release. Pointing `UPLOAD_DIR` at a location outside the build tree and
 * serving it through this route (rather than relying on `public/`'s static
 * passthrough) keeps uploads alive across every future deploy without a
 * symlink that would need recreating each time.
 *
 * The extension allow-list is the security boundary: the write pipelines only
 * ever produce these three, so anything else on that disk — however it got
 * there — is not reachable through this route.
 */
const TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params;
  const cfg = imageStoreConfig();

  const relative = segments.join('/');
  const resolved = path.resolve(cfg.uploadDir, relative);
  const contentType = TYPES[path.extname(resolved).toLowerCase()];

  // Refuse anything that traverses outside the upload root, and anything
  // that isn't a file this pipeline could have written.
  if (!resolved.startsWith(cfg.uploadDir + path.sep) || !contentType) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const stats = await stat(resolved);
    if (!stats.isFile()) throw new Error('not a file');

    // Filenames carry a random suffix, so a given URL never changes contents.
    const cache = 'public, max-age=31536000, immutable';
    const isVideo = contentType.startsWith('video/');

    if (!isVideo) {
      const body = await readFile(resolved);
      return new NextResponse(new Uint8Array(body), {
        headers: { 'Content-Type': contentType, 'Content-Length': String(stats.size), 'Cache-Control': cache },
      });
    }

    /**
     * Videos are streamed, and must answer range requests.
     *
     * Safari will not play a clip at all unless the server replies 206 to its
     * opening `Range: bytes=0-1` probe, and seeking anywhere in the timeline
     * is a range request in every browser. Reading the whole file into memory
     * per viewer, as the image path does, is also the wrong shape once a file
     * is tens of megabytes.
     */
    const range = req.headers.get('range');
    const match = range?.match(/^bytes=(\d*)-(\d*)$/);

    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), stats.size - 1) : stats.size - 1;

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= stats.size) {
        return new NextResponse(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${stats.size}` },
        });
      }

      const stream = Readable.toWeb(createReadStream(resolved, { start, end })) as ReadableStream;
      return new NextResponse(stream, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': cache,
        },
      });
    }

    const stream = Readable.toWeb(createReadStream(resolved)) as ReadableStream;
    return new NextResponse(stream, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stats.size),
        'Accept-Ranges': 'bytes',
        'Cache-Control': cache,
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
