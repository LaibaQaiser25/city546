import { Router } from 'express';
import { pool } from '../config/db.js';
import * as categories from '../controllers/categoryController.js';
import adminRoutes from './adminRoutes.js';
import aiRoutes from './aiRoutes.js';
import authRoutes from './authRoutes.js';
import oauthRoutes from './oauthRoutes.js';
import postRoutes from './postRoutes.js';
import referenceAccountRoutes from './referenceAccountRoutes.js';
import uploadRoutes from './uploadRoutes.js';

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, data: { status: 'ok', database: 'connected' } });
  } catch {
    res.status(503).json({ success: false, error: { code: 'DB_UNAVAILABLE', message: 'Database unavailable' } });
  }
});

router.use('/auth', authRoutes);
router.use('/posts', postRoutes);
router.get('/categories', categories.list);
router.use('/admin', adminRoutes);
router.use('/uploads', uploadRoutes);
router.use('/ai', aiRoutes);
router.use('/reference-accounts', referenceAccountRoutes);
router.use('/oauth', oauthRoutes);

export default router;
