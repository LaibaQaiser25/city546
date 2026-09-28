import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { ROOT_DIR, env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY); // correct client IPs (rate limiting) behind reverse proxies

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // News images are hot-linked from arbitrary https hosts.
          'img-src': ["'self'", 'data:', 'https:', 'http:'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          // Only force HTTPS sub-requests when running in production (behind TLS).
          'upgrade-insecure-requests': env.isProduction ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(
    cors({
      origin(origin, cb) {
        // Same-origin / non-browser requests have no Origin header.
        if (!origin || env.CORS_ORIGIN.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (!env.isTest) app.use(morgan(env.isProduction ? 'combined' : 'dev'));

  // Uploaded images: random, immutable filenames → safe to cache for a long time.
  app.use(
    '/uploads',
    express.static(env.UPLOAD_DIR, {
      index: false,
      dotfiles: 'deny',
      immutable: true,
      maxAge: '30d',
      setHeaders: (res) => {
        // Let other sites (e.g. social link previews) embed the images, but never run them as documents.
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
      },
    }),
  );
  app.use('/uploads', (_req, res) => res.status(404).end());

  app.use('/api', apiRoutes);
  app.use('/api', notFoundHandler);

  // In production, serve the built frontend (npm run build) from the same origin.
  const distDir = path.join(ROOT_DIR, 'frontend', 'dist');
  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use(express.static(distDir, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
