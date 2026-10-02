import { randomBytes } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { imageStoreConfig } from './image-store';

/**
 * Storage for product and review clips.
 *
 * Deliberately not part of the image pipeline. A video is written byte for
 * byte exactly as uploaded — there is no ffmpeg on this host, so nothing is
 * transcoded, resized or given a poster frame. That makes the format the
 * admin uploads the format every shopper downloads, which is why only the two
 * containers every current browser decodes are accepted.
 */
export class VideoError extends Error {}

/** Container → extension. MP4/H.264 plays everywhere; WebM covers the rest. */
const CONTAINERS = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
} as const;

export type VideoMime = keyof typeof CONTAINERS;

export interface StoredVideo {
  url: string;
  mime: VideoMime;
  bytes: number;
}

/** Ceiling for a single clip. Separate from MAX_UPLOAD_MB, which sizes stills. */
export function maxVideoBytes(): number {
  return Number(process.env.MAX_VIDEO_UPLOAD_MB || 32) * 1024 * 1024;
}

/**
 * Magic-number sniffing. A Content-Type header is caller-supplied and
 * untrusted, and this decides what extension lands on disk — which is in turn
 * what the serving route is willing to hand back.
 */
function sniffVideo(buf: Buffer): VideoMime | null {
  if (buf.length < 16) return null;

  // Matroska/WebM: EBML header.
  if (buf.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'video/webm';

  // ISO base media (MP4 and friends): a `ftyp` box with a known brand.
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('ascii');
    // `qt  ` is QuickTime — H.264 inside it usually plays, but not reliably in
    // every browser, so it is refused rather than shipped as a broken player.
    const mp4Brands = ['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'mmp4', 'M4V ', 'dash'];
    if (mp4Brands.includes(brand)) return 'video/mp4';
  }

  return null;
}

/** Validates and writes a clip. Returns the path to serve it from. */
export async function storeVideoBuffer(
  input: Buffer,
  opts: { folder?: string; baseName?: string } = {},
): Promise<StoredVideo> {
  const cfg = imageStoreConfig();
  const limit = maxVideoBytes();

  if (input.byteLength > limit) {
    throw new VideoError(`Video is larger than ${Math.round(limit / 1048576)}MB.`);
  }

  const mime = sniffVideo(input);
  if (!mime) {
    throw new VideoError('Only MP4 (H.264) or WebM videos are accepted. Export as MP4 and try again.');
  }

  const folder = (opts.folder ?? 'videos').replace(/[^a-z0-9/-]/gi, '');
  const safeName = (opts.baseName ?? 'clip').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 60) || 'clip';
  // Random suffix, so a URL's contents can never change and it stays cacheable.
  const base = `${safeName}-${randomBytes(6).toString('hex')}`;

  const dir = path.join(cfg.uploadDir, folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${base}.${CONTAINERS[mime]}`), input);

  return {
    url: `${cfg.publicPath}/${folder}/${base}.${CONTAINERS[mime]}`,
    mime,
    bytes: input.byteLength,
  };
}

/** Removes a stored clip. A missing file is not an error. */
export async function deleteStoredVideo(url: string): Promise<void> {
  const cfg = imageStoreConfig();
  if (!url.startsWith(`${cfg.publicPath}/`)) return;

  const relative = url.slice(cfg.publicPath.length + 1);
  const resolved = path.resolve(cfg.uploadDir, relative);
  if (!resolved.startsWith(cfg.uploadDir + path.sep)) return;
  if (!/\.(mp4|webm)$/.test(resolved)) return;

  await unlink(resolved).catch(() => undefined);
}
