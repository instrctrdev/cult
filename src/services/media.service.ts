import 'server-only';
import { AppError } from '@/lib/errors';
import {
  deleteStoredImage, imageStoreConfig, storeImageBuffer, storeImageFromUrl,
  ImageError, type StoredImage,
} from '@/lib/image-store';
import {
  deleteStoredVideo, maxVideoBytes, storeVideoBuffer, VideoError, type StoredVideo,
} from '@/lib/video-store';

export type { StoredImage, StoredVideo };

/**
 * Server-only wrapper around the image pipeline in `@/lib/image-store`.
 *
 * The split exists so the standalone catalogue importer can reuse the exact
 * same processing without pulling `server-only` into a plain Node process.
 * This layer's job is translating storage failures into the app's error
 * contract so route handlers get consistent, user-safe messages.
 */
export const MediaService = {
  get uploadRoot(): string {
    return imageStoreConfig().uploadDir;
  },

  async storeImage(input: Buffer, opts: { folder?: string; baseName?: string } = {}): Promise<StoredImage> {
    try {
      return await storeImageBuffer(input, opts);
    } catch (err) {
      if (err instanceof ImageError) throw new AppError('BAD_REQUEST', err.message);
      throw err;
    }
  },

  async storeFromUrl(url: string, opts: { folder?: string; baseName?: string } = {}): Promise<StoredImage> {
    try {
      return await storeImageFromUrl(url, opts);
    } catch (err) {
      if (err instanceof ImageError) throw new AppError('BAD_REQUEST', err.message);
      throw err;
    }
  },

  async storeVideo(input: Buffer, opts: { folder?: string; baseName?: string } = {}): Promise<StoredVideo> {
    try {
      return await storeVideoBuffer(input, opts);
    } catch (err) {
      if (err instanceof VideoError) throw new AppError('BAD_REQUEST', err.message);
      throw err;
    }
  },

  deleteImage: deleteStoredImage,
  deleteVideo: deleteStoredVideo,
  maxVideoBytes,
};
