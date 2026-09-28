import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { completeAuthorization } from '../ai/connectors/tiktokService.js';
import { env } from '../config/env.js';

/**
 * OAuth redirect targets. These can't use the admin cookie (SameSite=Strict is not sent on a
 * cross-site redirect); instead each request must carry a one-time, short-lived `state` that was
 * issued to the signed-in Admin. Redirects only ever go to a fixed internal page (no open redirect).
 */
const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });

const back = (res, params) => res.redirect(303, `${env.FRONTEND_URL}/admin/ai-style?${new URLSearchParams(params)}`);

router.get('/tiktok/callback', limiter, async (req, res) => {
  const str = (v) => (typeof v === 'string' ? v.slice(0, 2048) : undefined);
  const result = await completeAuthorization({
    code: str(req.query.code),
    state: str(req.query.state),
    error: str(req.query.error),
    errorDescription: str(req.query.error_description),
  });
  return result.ok
    ? back(res, { tiktok: 'connected' })
    : back(res, { tiktok: 'error', message: result.message.slice(0, 300) });
});

export default router;
