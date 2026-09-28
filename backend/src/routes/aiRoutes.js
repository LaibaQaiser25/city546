import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ai from '../controllers/aiController.js';
import { adminOnly } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../validators/schemas.js';
import {
  feedbackSchema,
  generateSchema,
  outcomeSchema,
  pageQuerySchema,
  regenerateSchema,
  settingsSchema,
} from '../validators/aiSchemas.js';

const router = Router();
router.use(...adminOnly); // every AI endpoint is Admin-only

const limitMessage = (what) => ({
  success: false,
  error: { code: 'TOO_MANY_REQUESTS', message: `Too many ${what}. Please wait a little and try again.` },
});
// Expensive endpoints are rate-limited to protect cost.
const generationLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 40, standardHeaders: 'draft-8', legacyHeaders: false, message: limitMessage('AI generations') });
const analysisLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false, message: limitMessage('style rebuilds') });

router.get('/status', ai.status);
router.get('/style', ai.getStyle);
router.post('/style/analyze', analysisLimiter, ai.rebuildStyle);
router.post('/style/rebuild', analysisLimiter, ai.rebuildStyle);

router.post('/generate-post', generationLimiter, validate(generateSchema), ai.generate);
router.post('/regenerate-post', generationLimiter, validate(regenerateSchema), ai.regenerate);

router.get('/generations', validate(pageQuerySchema, 'query'), ai.listGenerations);
router.post('/generations/:id/feedback', validate(idParamSchema, 'params'), validate(feedbackSchema), ai.feedback);
router.post('/generations/:id/outcome', validate(idParamSchema, 'params'), validate(outcomeSchema), ai.outcome);

router.get('/settings', ai.getSettings);
router.put('/settings', validate(settingsSchema), ai.saveSettings);
router.get('/usage', ai.usage);

export default router;
