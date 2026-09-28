/**
 * Claude provider (official Anthropic SDK).
 * - Structured output via `output_config.format` (JSON Schema) → JSON text, re-validated by zod upstream.
 * - Adaptive thinking; optional effort from AI_EFFORT.
 * - Server-side refusal fallbacks (`fallbacks: "default"`) on models that support them.
 * - Stable system rules + style profile are marked cacheable to cut cost on repeated generations.
 */
import Anthropic from '@anthropic-ai/sdk';
import { aiError } from '../errors.js';

export function createAnthropicProvider({ apiKey, model, effort, timeout }) {
  // apiKey undefined → the SDK falls back to ANTHROPIC_API_KEY / an `ant auth login` profile.
  const client = new Anthropic({ apiKey, timeout, maxRetries: 2 });
  const supportsFallbacks = /^claude-(opus-5|fable-5)/.test(model);
  const supportsAdaptiveThinking = !/haiku/.test(model);

  async function structured({ system, messages, schema, maxTokens = 16000 }) {
    const params = {
      model,
      max_tokens: maxTokens,
      system,
      messages,
      ...(supportsAdaptiveThinking && { thinking: { type: 'adaptive' } }),
      output_config: { format: { type: 'json_schema', schema }, ...(effort && { effort }) },
    };

    let res;
    try {
      res = supportsFallbacks
        ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
        : await client.messages.create(params);
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
        throw aiError('AI_NOT_CONFIGURED', 'The AI provider rejected the API key. Check AI_API_KEY on the server.', err);
      }
      if (err instanceof Anthropic.RateLimitError) {
        throw aiError('AI_RATE_LIMITED', 'The AI provider is rate-limiting requests. Try again in a minute.', err);
      }
      if (err instanceof Anthropic.BadRequestError) {
        throw aiError('AI_BAD_REQUEST', 'The AI provider rejected the request.', err);
      }
      if (err instanceof Anthropic.APIConnectionError || err instanceof Anthropic.APIError) {
        throw aiError('AI_UNAVAILABLE', 'The AI provider is unavailable right now.', err);
      }
      throw err;
    }

    if (res.stop_reason === 'refusal') {
      throw aiError('AI_REFUSED', 'The AI declined to write this content. You can continue manually.');
    }
    if (res.stop_reason === 'max_tokens') {
      throw aiError('AI_INVALID_OUTPUT', 'The AI response was cut off. Try again.');
    }

    const raw = res.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw aiError('AI_INVALID_OUTPUT', 'The AI returned data in an unexpected format. Try again.');
    }

    const u = res.usage || {};
    return {
      data,
      usage: {
        inputTokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
        outputTokens: u.output_tokens || 0,
      },
      model: res.model || model,
    };
  }

  return {
    name: 'anthropic',
    model,
    label: `Claude (${model})`,
    isDemo: false,
    structured,
    // Anthropic has no embeddings endpoint; retrieval falls back to PostgreSQL full-text search.
    // Plug an embeddings provider in here (plus a pgvector column) to enable semantic retrieval.
    supportsEmbeddings: false,
    async embed() {
      return null;
    },
  };
}
