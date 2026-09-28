import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { uploadImage } from '../controllers/uploadController.js';
import { adminOnly } from '../middleware/auth.js';

const router = Router();

// Files are held in memory so their content can be verified before anything touches the disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 5 },
});

// Authorization runs BEFORE multer, so anonymous requests are rejected without reading the body.
router.post('/', ...adminOnly, upload.single('image'), uploadImage);

export default router;
