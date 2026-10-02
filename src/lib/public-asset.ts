import 'server-only';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Resolves a `/images/...` or `/uploads/...` path to itself only if the file is
 * actually on disk, otherwise `null`.
 *
 * This is what lets an editor drop `hero-desktop.jpg` into `public/images/home/`
 * and have it appear with no database edit, while a section whose artwork has
 * not been supplied yet renders a labelled placeholder instead of a broken
 * image. Results are memoised because the homepage is revalidated rather than
 * rendered per request, so the filesystem is touched rarely.
 */
const cache = new Map<string, boolean>();

export function publicAsset(src: string | null | undefined): string | null {
  if (!src) return null;

  // Remote URLs are passed through untouched — nothing local to verify.
  if (/^https?:\/\//i.test(src)) return src;
  if (!src.startsWith('/')) return null;

  const cached = cache.get(src);
  if (cached !== undefined) return cached ? src : null;

  // Refuse traversal before touching the filesystem.
  const publicDir = path.join(process.cwd(), 'public');
  const resolved = path.resolve(publicDir, `.${src}`);
  if (!resolved.startsWith(publicDir + path.sep)) {
    cache.set(src, false);
    return null;
  }

  const exists = existsSync(resolved);
  cache.set(src, exists);
  return exists ? src : null;
}

/** Clears the memo — used after an admin upload so new artwork appears at once. */
export function clearAssetCache(): void {
  cache.clear();
}
