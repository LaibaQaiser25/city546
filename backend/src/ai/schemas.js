/**
 * Shapes for AI input/output.
 *  - JSON Schemas are sent to the model as structured-output formats (kept to the
 *    widely supported subset: types, enums, required, additionalProperties:false).
 *  - Zod schemas re-validate EVERYTHING the model returns on the server, clamp sizes
 *    and strip control characters. Model output is never trusted as-is.
 */
import { z } from 'zod';

const clean = (s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();

/** String that is cleaned and hard-truncated (never rejected for length). */
const text = (max, fallback = '') =>
  z
    .string()
    .catch(fallback)
    .transform((s) => clean(s).slice(0, max));

const list = (itemMax, maxItems) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((arr) =>
      arr
        .filter((v) => typeof v === 'string')
        .map((v) => clean(v).slice(0, itemMax))
        .filter(Boolean)
        .slice(0, maxItems),
    );

// ── Style profile ────────────────────────────────────────────
export const STYLE_PROFILE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary', 'primaryLanguage', 'languageNotes', 'tone', 'formality', 'headlineStyle', 'headlineTechniques',
    'openingPattern', 'structure', 'paragraphStyle', 'sentenceStyle', 'vocabularyTraits', 'emphasis',
    'factsPresentation', 'namesDatesLocations', 'closingPattern', 'captionStyle', 'emojiUsage', 'hashtagUsage',
    'commonHashtags', 'typicalLength', 'formattingRules', 'editorialCharacteristics', 'graphicStyle', 'adminPreferences',
  ],
  properties: {
    summary: { type: 'string', description: 'Two or three plain-language sentences describing the overall style.' },
    primaryLanguage: { type: 'string', enum: ['ur', 'en', 'mixed', 'other'] },
    languageNotes: { type: 'string', description: 'Script, code-mixing (e.g. English words inside Urdu), spelling conventions.' },
    tone: { type: 'array', items: { type: 'string' }, description: '3-6 short tone keywords.' },
    formality: { type: 'string' },
    headlineStyle: { type: 'string' },
    headlineTechniques: { type: 'array', items: { type: 'string' } },
    openingPattern: { type: 'string' },
    structure: { type: 'string', description: 'How a post is organised from top to bottom.' },
    paragraphStyle: { type: 'string' },
    sentenceStyle: { type: 'string' },
    vocabularyTraits: { type: 'array', items: { type: 'string' }, description: 'General traits of word choice. Never quote distinctive phrases from the examples.' },
    emphasis: { type: 'string' },
    factsPresentation: { type: 'string' },
    namesDatesLocations: { type: 'string' },
    closingPattern: { type: 'string' },
    captionStyle: { type: 'string' },
    emojiUsage: { type: 'string' },
    hashtagUsage: { type: 'string' },
    commonHashtags: { type: 'array', items: { type: 'string' }, description: 'Generic recurring hashtags only (topic/brand/place), max 10.' },
    typicalLength: { type: 'string' },
    formattingRules: { type: 'array', items: { type: 'string' } },
    editorialCharacteristics: { type: 'array', items: { type: 'string' } },
    graphicStyle: {
      type: 'object',
      additionalProperties: false,
      required: ['taglineStyle', 'headlineTreatment', 'bulletStyle'],
      properties: {
        taglineStyle: { type: 'string', description: 'How the short label above a news graphic is written (e.g. "Important news").' },
        headlineTreatment: { type: 'string', description: 'How a graphic headline is split into a location/context line, a punchy highlight, and a sub-line.' },
        bulletStyle: { type: 'string', description: 'How the fact bullets on a news graphic are phrased.' },
      },
    },
    adminPreferences: { type: 'array', items: { type: 'string' }, description: 'Preferences inferred from the admin’s edits/approvals; empty if none were supplied.' },
  },
};

export const styleProfileSchema = z.object({
  summary: text(600),
  primaryLanguage: z.enum(['ur', 'en', 'mixed', 'other']).catch('other'),
  languageNotes: text(400),
  tone: list(40, 8),
  formality: text(200),
  headlineStyle: text(400),
  headlineTechniques: list(160, 8),
  openingPattern: text(400),
  structure: text(500),
  paragraphStyle: text(300),
  sentenceStyle: text(300),
  vocabularyTraits: list(160, 10),
  emphasis: text(300),
  factsPresentation: text(400),
  namesDatesLocations: text(300),
  closingPattern: text(300),
  captionStyle: text(300),
  emojiUsage: text(200),
  hashtagUsage: text(200),
  commonHashtags: list(40, 10),
  typicalLength: text(200),
  formattingRules: list(200, 10),
  editorialCharacteristics: list(200, 10),
  graphicStyle: z
    .object({ taglineStyle: text(200), headlineTreatment: text(300), bulletStyle: text(300) })
    .catch({ taglineStyle: '', headlineTreatment: '', bulletStyle: '' }),
  adminPreferences: list(200, 10),
});

// ── Generated post ───────────────────────────────────────────
export const GRAPHIC_THEMES = ['breaking', 'crime', 'accident', 'politics', 'sports', 'business', 'weather', 'health', 'general'];

export const GENERATED_POST_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['heading', 'description', 'caption', 'hashtags', 'language', 'graphic', 'missingInfo'],
  properties: {
    heading: { type: 'string', description: 'Headline for the website post.' },
    description: { type: 'string', description: 'Body text. Separate paragraphs with a blank line.' },
    caption: { type: 'string', description: 'Short social-media caption.' },
    hashtags: { type: 'array', items: { type: 'string' } },
    language: { type: 'string', enum: ['ur', 'en', 'mixed'] },
    graphic: {
      type: 'object',
      additionalProperties: false,
      required: ['tagline', 'contextLine', 'highlight', 'subline', 'bullets', 'theme'],
      properties: {
        tagline: { type: 'string', description: 'Very short label at the top, 1-3 words.' },
        contextLine: { type: 'string', description: 'Where/when/who line above the highlight.' },
        highlight: { type: 'string', description: 'The punchiest 2-5 word core of the story.' },
        subline: { type: 'string', description: 'One short follow-up line (twist, status, or key detail).' },
        bullets: { type: 'array', items: { type: 'string' }, description: '2-5 short fact bullets, each a single sentence.' },
        theme: { type: 'string', enum: GRAPHIC_THEMES },
      },
    },
    missingInfo: {
      type: 'array',
      items: { type: 'string' },
      description: 'Details a reader would expect that the admin did NOT supply (you must not invent them).',
    },
  },
};

export const generatedPostSchema = z.object({
  heading: text(200),
  description: text(5000),
  caption: text(500),
  hashtags: list(40, 10).transform((tags) =>
    [...new Set(tags.map((t) => `#${t.replace(/^#+/, '').replace(/\s+/g, '')}`).filter((t) => t.length > 1))],
  ),
  language: z.enum(['ur', 'en', 'mixed']).catch('en'),
  graphic: z
    .object({
      tagline: text(40),
      contextLine: text(120),
      highlight: text(80),
      subline: text(120),
      bullets: list(180, 5),
      theme: z.enum(GRAPHIC_THEMES).catch('general'),
    })
    .catch({ tagline: '', contextLine: '', highlight: '', subline: '', bullets: [], theme: 'general' }),
  missingInfo: list(200, 6),
});

/** A usable post needs at least a heading and a description. */
export function assertUsablePost(post) {
  if (post.heading.length < 3 || post.description.length < 10) {
    const err = new Error('The AI returned an incomplete post');
    err.code = 'AI_INVALID_OUTPUT';
    throw err;
  }
  return post;
}
