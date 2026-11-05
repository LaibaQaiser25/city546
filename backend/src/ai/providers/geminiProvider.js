/**
 * Google Gemini provider (REST `generateContent`, no SDK dependency).
 * - Structured output via `responseMimeType: application/json` + `responseJsonSchema` → re-validated by zod upstream.
 * - The API key goes in the `x-goog-api-key` header (never the URL), so it can't leak into logs.
 * - Free tier (Google AI Studio key) is rate-limited and Google may use free-tier prompts to improve its models.
 */
import { aiError } from '../errors.js';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const BLOCKED_FINISH = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'IMAGE_SAFETY']);
// AI_EFFORT (Claude-style) → Gemini thinking level.
const THINKING_LEVEL = { low: 'low', medium: 'medium', high: 'high', xhigh: 'high', max: 'high' };

const blockText = (content) =>
  typeof content === 'string'
    ? content
    : (content || [])
        .filter((b) => b?.type === 'text')
        .map((b) => b.text)
        .join('\n\n');

/**
 * `fallbackModels` are tried in order when a model is overloaded (5xx), over its free-tier
 * quota (429, which is per model) or retired (404). `timeout` is the budget for the whole call.
 */
export function createGeminiProvider({
  apiKey,
  model,
  fallbackModels = [],
  effort,
  timeout,
  fetchImpl = fetch,
  retryDelayMs = 1000,
}) {
  const models = [...new Set([model, ...fallbackModels])];

  /** One model: retries a server error once. Throws `{ tryNext: true }`-tagged errors to move on. */
  async function callModel(name, body, deadline) {
    let lastErr;
    for (let attempt = 0; attempt <= 1; attempt += 1) {
      if (attempt) await new Promise((r) => setTimeout(r, retryDelayMs));
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw aiError('AI_UNAVAILABLE', 'The AI provider is unavailable right now.');
      let res;
      try {
        res = await fetchImpl(`${BASE_URL}/models/${encodeURIComponent(name)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey || '' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(remaining),
        });
      } catch (err) {
        // The time budget is spent: falling back would only fail again.
        if (err?.name === 'TimeoutError') throw aiError('AI_UNAVAILABLE', 'The AI provider is unavailable right now.', err);
        lastErr = Object.assign(aiError('AI_UNAVAILABLE', 'The AI provider is unavailable right now.', err), { tryNext: true });
        continue;
      }
      if (res.ok) return res.json();

      const detail = await res.json().catch(() => null);
      const reason = JSON.stringify(detail?.error?.details || '');
      if (res.status === 401 || res.status === 403 || reason.includes('API_KEY_INVALID')) {
        throw aiError('AI_NOT_CONFIGURED', 'The AI provider rejected the API key. Check AI_API_KEY on the server.');
      }
      if (res.status === 429) {
        throw Object.assign(
          aiError('AI_RATE_LIMITED', 'The AI provider is rate-limiting requests (free-tier limit). Try again in a minute.'),
          { tryNext: true },
        );
      }
      if (res.status === 404) {
        throw Object.assign(aiError('AI_UNAVAILABLE', `The AI model "${name}" is not available.`), { tryNext: true });
      }
      if (res.status >= 400 && res.status < 500) {
        throw aiError('AI_BAD_REQUEST', 'The AI provider rejected the request.', new Error(detail?.error?.message || res.statusText));
      }
      lastErr = Object.assign(
        aiError('AI_UNAVAILABLE', 'The AI provider is unavailable right now.', new Error(`HTTP ${res.status}`)),
        { tryNext: true },
      );
    }
    throw lastErr;
  }

  async function call(body) {
    const deadline = Date.now() + timeout;
    let lastErr;
    for (const name of models) {
      try {
        return { json: await callModel(name, body, deadline), usedModel: name };
      } catch (err) {
        if (!err.tryNext) throw err;
        lastErr = err;
        console.warn(`⚠️  Gemini model ${name} failed (${err.code}); ${name === models.at(-1) ? 'no fallback left' : 'trying the next one'}.`);
      }
    }
    throw lastErr;
  }

  async function structured({ system, messages, schema, maxTokens = 16000 }) {
    const level = effort && THINKING_LEVEL[effort];
    const { json: res, usedModel } = await call({
      systemInstruction: { parts: [{ text: blockText(system) }] },
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: blockText(m.content) }],
      })),
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
        maxOutputTokens: maxTokens,
        ...(level && { thinkingConfig: { thinkingLevel: level } }),
      },
    });

    const candidate = res.candidates?.[0];
    if (res.promptFeedback?.blockReason || BLOCKED_FINISH.has(candidate?.finishReason)) {
      throw aiError('AI_REFUSED', 'The AI declined to write this content. You can continue manually.');
    }
    if (candidate?.finishReason === 'MAX_TOKENS') {
      throw aiError('AI_INVALID_OUTPUT', 'The AI response was cut off. Try again.');
    }

    const raw = (candidate?.content?.parts || [])
      .filter((p) => !p.thought && typeof p.text === 'string')
      .map((p) => p.text)
      .join('');
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw aiError('AI_INVALID_OUTPUT', 'The AI returned data in an unexpected format. Try again.');
    }

    const u = res.usageMetadata || {};
    return {
      data,
      usage: {
        inputTokens: u.promptTokenCount || 0,
        outputTokens: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0),
      },
      model: res.modelVersion || usedModel,
    };
  }

  return {
    name: 'gemini',
    model,
    label: `Gemini (${model}${models.length > 1 ? ` + ${models.length - 1} fallback${models.length > 2 ? 's' : ''}` : ''})`,
    isDemo: false,
    structured,
    // Retrieval stays on PostgreSQL full-text search, same as the Claude provider.
    supportsEmbeddings: false,
    async embed() {
      return null;
    },
  };
}
