import { z } from 'zod';
import { imageUrl } from './schemas.js';

const clean = (s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
const str = (label, max, { min = 0 } = {}) =>
  z
    .string({ error: `${label} is required` })
    .transform(clean)
    .pipe(z.string().min(min, min ? `${label} is required` : undefined).max(max, `${label} must be at most ${max} characters`));

const optionalUrl = (label) =>
  z
    .string()
    .trim()
    .max(2048)
    .optional()
    .nullable()
    .transform((v) => v || null)
    .refine((v) => !v || /^https?:\/\//i.test(v), `${label} must start with http:// or https://`)
    .refine((v) => {
      if (!v) return true;
      try {
        new URL(v);
        return true;
      } catch {
        return false;
      }
    }, `${label} is not a valid URL`);

export const PLATFORMS = ['facebook', 'instagram', 'youtube', 'tiktok', 'x', 'website', 'other'];

export const referenceAccountSchema = z
  .object({
    platform: z.enum(PLATFORMS, { error: 'Choose a platform' }),
    accountName: str('Account name', 120, { min: 1 }),
    profileUrl: optionalUrl('Profile URL'),
    description: str('Description', 500).optional().nullable().transform((v) => v || null),
    sourceType: z.enum(['manual', 'feed', 'api']).default('manual'),
    feedUrl: optionalUrl('Feed URL'),
    externalAccountId: str('External account ID', 200).optional().nullable().transform((v) => v || null),
    active: z.boolean().default(true),
    connectionId: z.coerce.number().int().positive().nullable().optional().default(null),
  })
  .refine((a) => a.sourceType !== 'feed' || a.feedUrl, { message: 'A feed URL is required for feed sources', path: ['feedUrl'] })
  .refine((a) => a.sourceType !== 'api' || ['facebook', 'instagram', 'tiktok'].includes(a.platform), {
    message: 'The official API connector is available for Facebook, Instagram and TikTok only',
    path: ['sourceType'],
  })
  .refine((a) => !(a.sourceType === 'api' && a.platform === 'tiktok') || a.connectionId, {
    message: 'Choose a connected TikTok account',
    path: ['connectionId'],
  });

const referencePost = z.object({
  content: str('Post text', 20000, { min: 1 }),
  imageUrl: optionalUrl('Image URL'),
  publishedAt: z
    .string()
    .optional()
    .nullable()
    .transform((v) => {
      if (!v) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }),
  externalPostId: str('Post ID', 300).optional().nullable().transform((v) => v || null),
});

export const importPostsSchema = z.object({
  posts: z.array(referencePost).min(1, 'Nothing to import').max(500, 'Import at most 500 posts at a time'),
});

const rawInput = {
  heading: str('Heading / key information', 500, { min: 3 }),
  description: str('Details', 8000, { min: 10 }),
  imageUrl: imageUrl('Image').optional().nullable(),
  options: z
    .object({
      length: z.enum(['auto', 'short', 'medium', 'long']).default('auto'),
      tone: z.enum(['default', 'formal', 'urgent', 'neutral']).default('default'),
      language: z.enum(['auto', 'ur', 'en']).default('auto'),
    })
    .default({ length: 'auto', tone: 'default', language: 'auto' }),
};

export const generateSchema = z.object(rawInput);
export const regenerateSchema = z.object({
  ...rawInput,
  previousGenerationId: z.coerce.number().int().positive(),
});

export const feedbackSchema = z.object({ rating: z.enum(['good', 'bad']).nullable() });

export const outcomeSchema = z.object({
  postId: z.coerce.number().int().positive(),
  heading: z.string().max(500),
  description: z.string().max(20000),
});

export const settingsSchema = z.object({
  learnFromFeedback: z.boolean().default(false),
  autoRebuild: z.boolean().default(true),
  graphic: z
    .object({
      reporterName: str('Reporter name', 60).default(''),
      reporterPhotoUrl: imageUrl('Reporter photo').optional().nullable().or(z.literal('')).transform((v) => v || null),
      partnerLogoUrl: imageUrl('Partner logo').optional().nullable().or(z.literal('')).transform((v) => v || null),
      partnerLabel: str('Partner label', 40).default(''),
      defaultTagline: str('Default tagline', 30).default(''),
      showWordsWithMirza: z.boolean().default(true),
    })
    .default({}),
});

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const accountPostParams = z.object({
  id: z.coerce.number().int().positive(),
  postId: z.coerce.number().int().positive(),
});
