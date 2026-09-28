import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ref from '../controllers/referenceAccountController.js';
import { adminOnly } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../validators/schemas.js';
import { accountPostParams, importPostsSchema, pageQuerySchema, referenceAccountSchema } from '../validators/aiSchemas.js';

const router = Router();
router.use(...adminOnly);

// Be a polite API/feed client: limit how often sources are fetched.
const syncLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many syncs. Please wait a few minutes.' } },
});

const id = validate(idParamSchema, 'params');

router.get('/connectors', ref.connectors);
router.post('/connectors/meta/check', syncLimiter, ref.checkMeta);
router.post('/connectors/tiktok/authorize', syncLimiter, ref.tiktokAuthorize);
router.delete('/connectors/tiktok/:id', validate(idParamSchema, 'params'), ref.tiktokDisconnect);
router.get('/', ref.list);
router.post('/', validate(referenceAccountSchema), ref.create);
router.put('/:id', id, validate(referenceAccountSchema), ref.update);
router.delete('/:id', id, ref.remove);
router.post('/:id/sync', id, syncLimiter, ref.sync);
router.get('/:id/posts', id, validate(pageQuerySchema, 'query'), ref.listPosts);
router.post('/:id/posts', id, validate(importPostsSchema), ref.importPosts);
router.delete('/:id/posts/:postId', validate(accountPostParams, 'params'), ref.removePost);

export default router;
