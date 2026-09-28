import { Router } from 'express';
import * as posts from '../controllers/postController.js';
import { adminOnly, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema, listQuerySchema, postSchema } from '../validators/schemas.js';

const router = Router();

// ── Public (read-only) ──
router.get('/', validate(listQuerySchema, 'query'), posts.listPublished);
router.get('/:id', validate(idParamSchema, 'params'), optionalAuth, posts.getOne);
router.post('/:id/view', validate(idParamSchema, 'params'), posts.registerView);

// ── Admin only — enforced server-side on every request ──
router.post('/', ...adminOnly, validate(postSchema), posts.create);
router.put('/:id', ...adminOnly, validate(idParamSchema, 'params'), validate(postSchema), posts.update);
router.delete('/:id', ...adminOnly, validate(idParamSchema, 'params'), posts.remove);

export default router;
