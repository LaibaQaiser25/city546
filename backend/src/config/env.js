import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The single `.env` lives at the repository root. A backend/.env (if any) takes precedence.
export const ROOT_DIR = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(ROOT_DIR, 'backend', '.env'), quiet: true });
dotenv.config({ path: path.join(ROOT_DIR, '.env'), quiet: true });

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name} (see .env.example)`);
  }
  return value.trim();
}

const JWT_SECRET = required('JWT_SECRET');
if (JWT_SECRET.length < 32) {
  const msg = 'JWT_SECRET should be at least 32 characters long.';
  if (isProduction) throw new Error(msg);
  console.warn(`⚠️  ${msg}`);
}
if (isProduction && /change_this/i.test(JWT_SECRET)) {
  throw new Error('JWT_SECRET still has the example value. Set a real secret before running in production.');
}

export const env = {
  NODE_ENV,
  isProduction,
  isTest: NODE_ENV === 'test',
  PORT: Number(process.env.PORT) || 5000,
  DATABASE_URL: required('DATABASE_URL'),
  DATABASE_SSL: process.env.DATABASE_SSL === 'true',
  JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '12h',
  CORS_ORIGIN: (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Where uploaded images are stored on disk (served publicly at /uploads).
  UPLOAD_DIR: path.resolve(ROOT_DIR, process.env.UPLOAD_DIR || 'backend/uploads'),
  MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB) || 8,

  // ── AI styling (all AI calls happen server-side; keys never reach the browser) ──
  // anthropic = Claude via the official SDK · mock = offline demo (no real AI) · none = disabled
  AI_PROVIDER: (process.env.AI_PROVIDER || (process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'none'))
    .trim()
    .toLowerCase(),
  AI_API_KEY: process.env.AI_API_KEY?.trim() || undefined,
  AI_MODEL: process.env.AI_MODEL?.trim() || 'claude-opus-5',
  AI_EFFORT: process.env.AI_EFFORT?.trim() || undefined, // low | medium | high | xhigh | max (unset = API default)
  AI_EMBEDDING_MODEL: process.env.AI_EMBEDDING_MODEL?.trim() || undefined,
  AI_ANALYSIS_MAX_POSTS: Number(process.env.AI_ANALYSIS_MAX_POSTS) || 150,
  AI_EXAMPLES_PER_GENERATION: Number(process.env.AI_EXAMPLES_PER_GENERATION ?? 3),
  AI_TIMEOUT_MS: Number(process.env.AI_TIMEOUT_MS) || 180_000,
  // Feeds on private/internal networks are blocked (SSRF protection) unless explicitly allowed.
  ALLOW_PRIVATE_FEED_URLS: process.env.ALLOW_PRIVATE_FEED_URLS === 'true',

  // ── Meta Graph API (official Facebook / Instagram connectors; server-side only) ──
  META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN?.trim() || undefined,
  META_APP_SECRET: process.env.META_APP_SECRET?.trim() || undefined, // enables appsecret_proof
  META_IG_USER_ID: process.env.META_IG_USER_ID?.trim() || undefined, // your IG Business/Creator account id
  META_GRAPH_VERSION: process.env.META_GRAPH_VERSION?.trim() || 'v26.0',
  META_MAX_POSTS_PER_SYNC: Number(process.env.META_MAX_POSTS_PER_SYNC) || 100,

  // ── TikTok (official Login Kit + Display API; reads accounts that authorise the app) ──
  TIKTOK_CLIENT_KEY: process.env.TIKTOK_CLIENT_KEY?.trim() || undefined,
  TIKTOK_CLIENT_SECRET: process.env.TIKTOK_CLIENT_SECRET?.trim() || undefined,
  // Must exactly match a redirect URI registered in the TikTok developer portal,
  // e.g. https://your-domain/api/oauth/tiktok/callback
  TIKTOK_REDIRECT_URI: process.env.TIKTOK_REDIRECT_URI?.trim() || undefined,
  TIKTOK_MAX_POSTS_PER_SYNC: Number(process.env.TIKTOK_MAX_POSTS_PER_SYNC) || 100,
  // Where the admin UI lives (only needed when the frontend is hosted on another origin)
  FRONTEND_URL: (process.env.FRONTEND_URL || '').trim().replace(/\/$/, ''),
  // Key for encrypting third-party tokens at rest (defaults to a key derived from JWT_SECRET)
  TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY?.trim() || undefined,
};
