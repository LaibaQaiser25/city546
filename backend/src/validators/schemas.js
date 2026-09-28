import { z } from 'zod';
import { UPLOADED_PATH_RE } from '../services/uploadService.js';

export const LIMITS = {
  HEADING_MIN: 3,
  HEADING_MAX: 200,
  DESCRIPTION_MIN: 10,
  DESCRIPTION_MAX: 20000,
  URL_MAX: 2048,
  CAPTION_MAX: 300,
  BLOCK_HEADING_MAX: 200,
  BLOCK_TEXT_MAX: 10000,
  BLOCKS_MAX: 40,
  SEARCH_MAX: 100,
};

/** Strips ASCII control chars (except \n and \t) and trims. */
const clean = (s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();

const text = (label, min, max) =>
  z
    .string({ error: `${label} is required` })
    .transform(clean)
    .pipe(
      z
        .string()
        .min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
        .max(max, `${label} must be at most ${max} characters`),
    );

export const imageUrl = (label = 'Image URL') =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(LIMITS.URL_MAX, `${label} is too long`)
    .refine((value) => {
      if (UPLOADED_PATH_RE.test(value)) return true; // image uploaded to this server
      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    }, `${label} must be an uploaded image or a valid http(s) URL`);

const blockId = z.string().trim().max(64).optional();

const imageBlock = z.object({
  id: blockId,
  type: z.literal('image'),
  url: imageUrl('Block image URL'),
  caption: z
    .string()
    .max(LIMITS.CAPTION_MAX, `Caption must be at most ${LIMITS.CAPTION_MAX} characters`)
    .optional()
    .default('')
    .transform(clean),
});

const headingBlock = z.object({
  id: blockId,
  type: z.literal('heading'),
  text: text('Sub-heading', 1, LIMITS.BLOCK_HEADING_MAX),
});

const paragraphBlock = z.object({
  id: blockId,
  type: z.literal('paragraph'),
  text: text('Paragraph', 1, LIMITS.BLOCK_TEXT_MAX),
});

export const blockSchema = z.discriminatedUnion('type', [imageBlock, headingBlock, paragraphBlock], {
  error: 'Block type must be one of: image, heading, paragraph',
});

export const postSchema = z.object({
  imageUrl: imageUrl('Image'),
  heading: text('Heading', LIMITS.HEADING_MIN, LIMITS.HEADING_MAX),
  description: text('Description', LIMITS.DESCRIPTION_MIN, LIMITS.DESCRIPTION_MAX),
  blocks: z.array(blockSchema).max(LIMITS.BLOCKS_MAX, `A post can have at most ${LIMITS.BLOCKS_MAX} extra blocks`).default([]),
  categoryId: z.coerce.number().int().positive().nullable().optional().default(null),
  published: z.boolean().optional().default(true),
});

export const loginSchema = z.object({
  email: z.string({ error: 'Email is required' }).trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required').max(200),
});

export const listQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(LIMITS.SEARCH_MAX, 'Search is too long')
    .optional()
    .transform((v) => v || undefined),
  category: z
    .string()
    .trim()
    .toLowerCase()
    .max(60)
    .regex(/^[a-z0-9-]*$/, 'Invalid category')
    .optional()
    .transform((v) => v || undefined),
  status: z.enum(['all', 'published', 'draft']).optional().default('all'),
  sort: z.enum(['latest', 'popular']).optional().default('latest'),
  page: z.coerce.number().int().min(1).max(10000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export const idParamSchema = z.object({
  id: z.coerce.number({ error: 'Invalid post id' }).int('Invalid post id').positive('Invalid post id').max(Number.MAX_SAFE_INTEGER),
});
