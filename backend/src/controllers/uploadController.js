import { detectImageType, saveImage } from '../services/uploadService.js';
import { badRequest } from '../utils/httpError.js';
import { ok } from '../utils/respond.js';

/** POST /api/uploads — multipart field "image" (admin only). */
export async function uploadImage(req, res) {
  if (!req.file) throw badRequest('Choose an image to upload', [{ field: 'image', message: 'No file received' }]);

  const type = detectImageType(req.file.buffer);
  if (!type) {
    throw badRequest('Only JPG, PNG, WebP or GIF images can be uploaded', [
      { field: 'image', message: 'Unsupported file type' },
    ]);
  }

  const url = await saveImage(req.file.buffer, type);
  return ok(res, { url, size: req.file.size, type: type.mime }, { status: 201, message: 'Image uploaded' });
}
