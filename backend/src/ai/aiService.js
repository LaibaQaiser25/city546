/**
 * AIService — the single entry point the rest of the app uses for AI.
 *
 *   analyzeStyle()       reference posts → structured style profile
 *   generatePost()       admin facts + profile + examples → structured post
 *   regeneratePost()     same, asking for a different wording
 *   generateEmbeddings() optional; null when the provider has no embeddings
 *
 * Providers are pluggable (AI_PROVIDER). Every call is logged to ai_generation_logs,
 * and every output is re-validated here before anything else sees it.
 */
import { env } from '../config/env.js';
import * as AI from '../models/aiModel.js';
import { aiError } from './errors.js';
import {
  ANALYSIS_SYSTEM,
  GENERATION_SYSTEM,
  buildAnalysisMessage,
  buildGenerationMessage,
  buildStyleBlock,
} from './prompts.js';
import { createAnthropicProvider } from './providers/anthropicProvider.js';
import { createMockProvider } from './providers/mockProvider.js';
import {
  GENERATED_POST_JSON_SCHEMA,
  STYLE_PROFILE_JSON_SCHEMA,
  assertUsablePost,
  generatedPostSchema,
  styleProfileSchema,
} from './schemas.js';

let cachedProvider;

function createProvider() {
  switch (env.AI_PROVIDER) {
    case 'anthropic':
      return createAnthropicProvider({
        apiKey: env.AI_API_KEY,
        model: env.AI_MODEL,
        effort: env.AI_EFFORT,
        timeout: env.AI_TIMEOUT_MS,
      });
    case 'mock':
    case 'demo':
      return createMockProvider();
    case 'none':
    case '':
      return null;
    default:
      console.warn(`⚠️  Unknown AI_PROVIDER "${env.AI_PROVIDER}" — AI features disabled.`);
      return null;
  }
}

export function getProvider() {
  if (cachedProvider === undefined) cachedProvider = createProvider();
  return cachedProvider;
}

/** Test hook: swap the provider (e.g. to the demo provider). */
export function setProviderForTesting(provider) {
  cachedProvider = provider;
}

export function aiStatus() {
  const p = getProvider();
  return p
    ? { enabled: true, provider: p.name, label: p.label, model: p.model, demo: p.isDemo, embeddings: p.supportsEmbeddings }
    : { enabled: false, provider: 'none', label: 'Not configured', model: null, demo: false, embeddings: false };
}

function requireProvider() {
  const p = getProvider();
  if (!p) throw aiError('AI_DISABLED', 'AI styling is not configured on this server.');
  return p;
}

/** Runs one provider call with timing + usage logging. */
async function tracked(operation, userId, fn) {
  const p = requireProvider();
  const started = Date.now();
  try {
    const result = await fn(p);
    await AI.logUsage({
      userId,
      operation,
      provider: p.name,
      model: result.model,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      status: 'success',
      durationMs: Date.now() - started,
    }).catch(() => {});
    return result;
  } catch (err) {
    await AI.logUsage({
      userId,
      operation,
      provider: p.name,
      model: p.model,
      status: 'error',
      error: `${err.code || 'ERROR'}: ${err.message}`,
      durationMs: Date.now() - started,
    }).catch(() => {});
    throw err;
  }
}

/** Stage 1 — learn the style from reference posts. */
export async function analyzeStyle({ posts, feedback = [], userId }) {
  const result = await tracked('analyze_style', userId, (p) =>
    p.structured({
      kind: 'analysis',
      payload: { posts },
      system: ANALYSIS_SYSTEM,
      messages: [{ role: 'user', content: buildAnalysisMessage({ posts, feedback }) }],
      schema: STYLE_PROFILE_JSON_SCHEMA,
    }),
  );
  const parsed = styleProfileSchema.safeParse(result.data);
  if (!parsed.success || !parsed.data.summary) {
    throw aiError('AI_INVALID_OUTPUT', 'The AI returned an incomplete style profile. Try rebuilding.');
  }
  return { profile: parsed.data, model: result.model };
}

/** Stage 2 — write a post in the learned style from the admin's facts. */
export async function generatePost({ input, profile, examples, options, previous, userId }) {
  const operation = previous ? 'regenerate_post' : 'generate_post';
  const result = await tracked(operation, userId, (p) =>
    p.structured({
      kind: 'generation',
      payload: { input, options, profile, previous },
      system: [
        { type: 'text', text: GENERATION_SYSTEM },
        // Profile changes rarely → cache the stable prefix across generations.
        { type: 'text', text: buildStyleBlock(profile), cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: buildGenerationMessage({ input, examples, options, previous }) }],
      schema: GENERATED_POST_JSON_SCHEMA,
      maxTokens: 16000,
    }),
  );
  const parsed = generatedPostSchema.safeParse(result.data);
  if (!parsed.success) throw aiError('AI_INVALID_OUTPUT', 'The AI returned data in an unexpected format. Try again.');
  return { post: assertUsablePost(parsed.data), model: result.model };
}

export const regeneratePost = (args) => generatePost(args);

/** Optional semantic retrieval support. Returns null when unsupported. */
export async function generateEmbeddings(texts, userId) {
  const p = getProvider();
  if (!p?.supportsEmbeddings) return null;
  const result = await tracked('embeddings', userId, async (prov) => ({
    data: await prov.embed(texts, env.AI_EMBEDDING_MODEL),
    model: env.AI_EMBEDDING_MODEL,
  }));
  return result.data;
}
