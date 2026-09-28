import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

export const UPLOAD_URL_PREFIX = '/uploads/';

/**
 * Identifies the image type from the file's magic bytes. The client-supplied
 * MIME type and filename are never trusted. SVG is deliberately not accepted
 * because it can carry scripts.
 */
export function detectImageType(buffer) {
  if (buffer.length < 12) return null;
  const hex = buffer.subarray(0, 12).toString('hex');
  if (hex.startsWith('ffd8ff')) return { ext: 'jpg', mime: 'image/jpeg' };
  if (hex.startsWith('89504e470d0a1a0a')) return { ext: 'png', mime: 'image/png' };
  if (hex.startsWith('474946383761') || hex.startsWith('474946383961')) return { ext: 'gif', mime: 'image/gif' };
  if (hex.startsWith('52494646') && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  return null;
}

/** Writes a verified image to UPLOAD_DIR under a random name; returns its public path. */
export async function saveImage(buffer, type) {
  await fs.mkdir(env.UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.${type.ext}`;
  await fs.writeFile(path.join(env.UPLOAD_DIR, filename), buffer, { flag: 'wx' });
  return `${UPLOAD_URL_PREFIX}${filename}`;
}

/** Matches paths produced by saveImage, e.g. /uploads/3f2c…e1.jpg */
export const UPLOADED_PATH_RE = /^\/uploads\/[0-9a-f-]{36}\.(jpg|png|gif|webp)$/;

/** Every uploaded-image path referenced by a post (cover + image blocks). */
export const uploadedPathsOf = (post) =>
  [post?.imageUrl, ...(post?.blocks || []).map((b) => b.url)].filter((u) => u && UPLOADED_PATH_RE.test(u));

/**
 * Deletes uploaded files that no post references any more (after a post is
 * deleted or its images are replaced). Best effort: failures are only logged.
 */
export async function removeUnreferencedUploads(paths, query) {
  for (const url of new Set(paths)) {
    try {
      const { rowCount } = await query(
        `SELECT 1 FROM posts
          WHERE image_url = $1 OR blocks @> jsonb_build_array(jsonb_build_object('url', $1::text))
          LIMIT 1`,
        [url],
      );
      if (rowCount === 0) await fs.unlink(path.join(env.UPLOAD_DIR, path.basename(url)));
    } catch (err) {
      if (err.code !== 'ENOENT') console.warn(`Could not clean up ${url}: ${err.message}`);
    }
  }
}
