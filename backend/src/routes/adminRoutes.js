import { Router } from 'express';
import * as posts from '../controllers/postController.js';
import { adminOnly } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listQuerySchema } from '../validators/schemas.js';

const router = Router();

// Every route in this router requires the authenticated Admin.
router.use(...adminOnly);

router.get('/stats', posts.stats);
router.get('/posts', validate(listQuerySchema, 'query'), posts.listAll);

export default router;
