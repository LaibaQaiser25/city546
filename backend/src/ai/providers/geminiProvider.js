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

export function createGeminiProvider({ apiKey, model, effort, timeout, fetchImpl = fetch, retryDelayMs = 1000 }) {
  async function call(body) {
    let lastErr;
    for (let attempt = 0; attempt <= 2; attempt += 1) {
      if (attempt) await new Promise((r) => setTimeout(r, retryDelayMs * attempt));
      let res;
      try {
        res = await fetchImpl(`${BASE_URL}/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey || '' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeout),
        });
      } catch (err) {
        lastErr = aiError('AI_UNAVAILABLE', 'The AI provider is unavailable right now.', err);
        if (err?.name === 'TimeoutError') throw lastErr; // don't multiply a long timeout
        continue;
      }
      if (res.ok) return res.json();

      const detail = await res.json().catch(() => null);
      const reason = JSON.stringify(detail?.error?.details || '');
      if (res.status === 401 || res.status === 403 || reason.includes('API_KEY_INVALID')) {
        throw aiError('AI_NOT_CONFIGURED', 'The AI provider rejected the API key. Check AI_API_KEY on the server.');
      }
      if (res.status === 429) {
        throw aiError('AI_RATE_LIMITED', 'The AI provider is rate-limiting requests (free-tier limit). Try again in a minute.');
      }
      if (res.status >= 400 && res.status < 500) {
        throw aiError('AI_BAD_REQUEST', 'The AI provider rejected the request.', new Error(detail?.error?.message || res.statusText));
      }
      lastErr = aiError('AI_UNAVAILABLE', 'The AI provider is unavailable right now.', new Error(`HTTP ${res.status}`));
    }
    throw lastErr;
  }

  async function structured({ system, messages, schema, maxTokens = 16000 }) {
    const level = effort && THINKING_LEVEL[effort];
    const res = await call({
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
      model: res.modelVersion || model,
    };
  }

  return {
    name: 'gemini',
    model,
    label: `Gemini (${model})`,
    isDemo: false,
    structured,
    // Retrieval stays on PostgreSQL full-text search, same as the Claude provider.
    supportsEmbeddings: false,
    async embed() {
      return null;
    },
  };
}
