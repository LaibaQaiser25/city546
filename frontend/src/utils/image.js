const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_DIMENSION = 2000; // px on the longest side — plenty for a news layout
const TARGET_BYTES = 1.5 * 1024 * 1024;

/**
 * Prepares a picked photo for upload. Phone photos are often 4–12 MB, so large images
 * are resized (longest side ≤ 2000px) and re-encoded in the browser. Small JPG/PNG/WebP
 * files and GIFs (to keep animation) are uploaded as-is.
 */
export async function prepareImage(file) {
  if (!file.type.startsWith('image/') && file.type !== '') {
    throw new Error('Please choose an image file (JPG, PNG, WebP or GIF).');
  }
  if (file.type === 'image/gif') return file;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // The browser can't decode it (e.g. HEIC on some desktops). Upload the original;
    // the server verifies the real file type and returns a clear error if unsupported.
    return file;
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= TARGET_BYTES && ACCEPTED.includes(file.type)) {
    bitmap.close();
    return file;
  }

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // PNGs may have transparency → WebP keeps it; everything else → JPEG.
  const type = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));
  if (!blob || blob.size >= file.size) return file.size <= TARGET_BYTES * 4 ? file : blob || file;

  const ext = blob.type.split('/')[1].replace('jpeg', 'jpg');
  const base = (file.name || 'photo').replace(/\.[^.]+$/, '');
  return new File([blob], `${base}.${ext}`, { type: blob.type });
}

export const formatBytes = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
