import { prepareImage } from '../utils/image';
import { api } from './api';

/**
 * Uploads an image picked from the device (admin only — the API checks the session).
 * Resolves to the stored image path, e.g. "/uploads/<uuid>.jpg".
 */
export async function uploadImage(file, { onProgress, signal } = {}) {
  const prepared = await prepareImage(file);
  const body = new FormData();
  body.append('image', prepared, prepared.name || 'photo');
  const { data } = await api.post('/uploads', body, {
    signal,
    timeout: 120_000, // slow mobile connections
    onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
  });
  return data.data.url;
}
