/**
 * Image processing and disk storage.
 *
 * Runtime-neutral on purpose: this module carries no `server-only` marker so
 * the standalone catalogue importer (plain Node via tsx) can use exactly the
 * same pipeline the app uses. `MediaService` is the server-only wrapper around it.
 *
 * Assets land on the Hostinger filesystem under public/uploads — no S3, R2 or
 * Cloudinary, per the cost constraint. Only re-encoded output is written, so
 * the original bytes (and anything hidden in them) are never persisted.
 */
import { createHash, randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

/** Widths generated for every upload; Next/Image then picks per breakpoint. */
export const IMAGE_WIDTHS = [400, 800, 1200, 1600];
const MAX_DIMENSION = 2000;

export class ImageError extends Error {}

/** Magic-number sniffing — a Content-Type header is caller-supplied and untrusted. */
function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp' && buf.subarray(8, 12).toString('ascii').startsWith('avif')) return 'image/avif';
  return null;
}

export interface StoredImage {
  url: string;
  width: number;
  height: number;
  blurDataUrl: string;
  bytes: number;
}

export interface ImageStoreConfig {
  uploadDir: string;
  publicPath: string;
  maxBytes: number;
}

export function imageStoreConfig(): ImageStoreConfig {
  return {
    uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR || './public/uploads'),
    publicPath: process.env.NEXT_PUBLIC_UPLOAD_PATH || '/uploads',
    maxBytes: Number(process.env.MAX_UPLOAD_MB || 8) * 1024 * 1024,
  };
}

/** Validates, re-encodes and writes an image plus its responsive derivatives. */
export async function storeImageBuffer(
  input: Buffer,
  opts: { folder?: string; baseName?: string } = {},
): Promise<StoredImage> {
  const cfg = imageStoreConfig();

  if (input.byteLength > cfg.maxBytes) {
    throw new ImageError(`Image is larger than ${Math.round(cfg.maxBytes / 1048576)}MB.`);
  }

  const mime = sniffMime(input);
  if (!mime || !ALLOWED_MIME.has(mime)) {
    throw new ImageError('Only JPEG, PNG, WebP or AVIF images are accepted.');
  }

  let meta: sharp.Metadata;
  try {
    // `limitInputPixels` guards against decompression-bomb images.
    meta = await sharp(input, { limitInputPixels: 50_000_000, failOn: 'error' }).metadata();
  } catch {
    throw new ImageError('That file could not be read as an image.');
  }
  if (!meta.width || !meta.height) throw new ImageError('Image has no readable dimensions.');

  const folder = (opts.folder ?? 'products').replace(/[^a-z0-9-]/gi, '') || 'products';
  const safeBase = (opts.baseName ?? 'img').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'img';
  const base = `${safeBase}-${randomUUID().slice(0, 8)}`;

  const dir = path.join(cfg.uploadDir, folder);
  await mkdir(dir, { recursive: true });

  const targetWidth = Math.min(meta.width, MAX_DIMENSION);

  // Canonical asset — always WebP, EXIF stripped, orientation applied.
  const canonical = await sharp(input)
    .rotate()
    .resize({ width: targetWidth, withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  await writeFile(path.join(dir, `${base}.webp`), canonical.data);

  // Smaller widths, so a 1600px original is never shipped to a phone.
  await Promise.all(
    IMAGE_WIDTHS.filter((w) => w < targetWidth).map(async (w) => {
      const buf = await sharp(input)
        .rotate()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 78, effort: 4 })
        .toBuffer();
      await writeFile(path.join(dir, `${base}-${w}.webp`), buf);
    }),
  );

  // Tiny inline preview, used as Next/Image's blurDataURL.
  const blur = await sharp(input).rotate().resize(16).webp({ quality: 40 }).toBuffer();

  return {
    url: `${cfg.publicPath}/${folder}/${base}.webp`,
    width: canonical.info.width,
    height: canonical.info.height,
    blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}`,
    bytes: canonical.data.byteLength,
  };
}

/** Downloads a remote image and stores it. Used by the one-time catalogue import. */
export async function storeImageFromUrl(
  url: string,
  opts: { folder?: string; baseName?: string } = {},
): Promise<StoredImage> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'CULTImporter/1.0' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new ImageError(`Could not fetch image (HTTP ${res.status}).`);

  const buf = Buffer.from(await res.arrayBuffer());
  const name = opts.baseName ?? createHash('sha1').update(url).digest('hex').slice(0, 12);
  return storeImageBuffer(buf, { ...opts, baseName: name });
}

/** Removes an asset and every derivative. Missing files are not an error. */
export async function deleteStoredImage(url: string): Promise<void> {
  const cfg = imageStoreConfig();
  if (!url.startsWith(`${cfg.publicPath}/`)) return;

  const relative = url.slice(cfg.publicPath.length + 1);
  const resolved = path.resolve(cfg.uploadDir, relative);
  // Refuse anything that resolves outside the upload root.
  if (!resolved.startsWith(cfg.uploadDir + path.sep)) return;

  const dir = path.dirname(resolved);
  const base = path.basename(resolved, '.webp');
  await Promise.all(
    ['', ...IMAGE_WIDTHS.map((w) => `-${w}`)].map((suffix) =>
      unlink(path.join(dir, `${base}${suffix}.webp`)).catch(() => undefined),
    ),
  );
}
