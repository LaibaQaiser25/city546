/**
 * Gemini provider tests. Uses an injected fake fetch — never calls Google.
 *   npm test
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

process.env.NODE_ENV = 'test';
const { createGeminiProvider } = await import('../src/ai/providers/geminiProvider.js');
const { GENERATED_POST_JSON_SCHEMA } = await import('../src/ai/schemas.js');

const KEY = 'test-gemini-key';

function fakeFetch(responses) {
  const calls = [];
  const queue = [...responses];
  const impl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
  };
  return { impl, calls };
}

const provider = (fetchImpl, extra = {}) =>
  createGeminiProvider({ apiKey: KEY, model: 'gemini-test', timeout: 5000, fetchImpl, retryDelayMs: 1, ...extra });

const request = {
  system: [
    { type: 'text', text: 'RULES' },
    { type: 'text', text: 'PROFILE', cache_control: { type: 'ephemeral' } },
  ],
  messages: [{ role: 'user', content: 'FACTS' }],
  schema: GENERATED_POST_JSON_SCHEMA,
  maxTokens: 1234,
};

const okBody = (data, extra = {}) => ({
  candidates: [
    {
      finishReason: 'STOP',
      content: { parts: [{ text: 'thinking…', thought: true }, { text: JSON.stringify(data) }] },
    },
  ],
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 3 },
  modelVersion: 'gemini-test-001',
  ...extra,
});

describe('gemini provider', () => {
  test('sends a structured JSON request with the key in a header, not the URL', async () => {
    const { impl, calls } = fakeFetch([{ body: okBody({ heading: 'Hi' }) }]);
    const result = await provider(impl, { effort: 'xhigh' }).structured(request);

    assert.deepEqual(result.data, { heading: 'Hi' });
    assert.deepEqual(result.usage, { inputTokens: 10, outputTokens: 8 });
    assert.equal(result.model, 'gemini-test-001');

    const [call] = calls;
    assert.match(call.url, /\/models\/gemini-test:generateContent$/);
    assert.ok(!call.url.includes(KEY));
    assert.equal(call.init.headers['x-goog-api-key'], KEY);
    assert.equal(call.body.systemInstruction.parts[0].text, 'RULES\n\nPROFILE');
    assert.deepEqual(call.body.contents, [{ role: 'user', parts: [{ text: 'FACTS' }] }]);
    assert.equal(call.body.generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(call.body.generationConfig.responseJsonSchema, GENERATED_POST_JSON_SCHEMA);
    assert.equal(call.body.generationConfig.maxOutputTokens, 1234);
    assert.deepEqual(call.body.generationConfig.thinkingConfig, { thinkingLevel: 'high' });
  });

  test('maps API errors to friendly AI error codes', async () => {
    const cases = [
      [{ status: 400, body: { error: { message: 'API key not valid', details: [{ reason: 'API_KEY_INVALID' }] } } }, 'AI_NOT_CONFIGURED'],
      [{ status: 403, body: { error: { message: 'denied' } } }, 'AI_NOT_CONFIGURED'],
      [{ status: 429, body: { error: { message: 'quota' } } }, 'AI_RATE_LIMITED'],
      [{ status: 400, body: { error: { message: 'bad schema' } } }, 'AI_BAD_REQUEST'],
    ];
    for (const [response, code] of cases) {
      const { impl } = fakeFetch([response]);
      await assert.rejects(provider(impl).structured(request), (err) => {
        assert.equal(err.code, code);
        assert.ok(!err.message.includes(KEY));
        return true;
      });
    }
  });

  test('retries server errors, then gives up as unavailable', async () => {
    const good = fakeFetch([{ status: 503, body: {} }, { body: okBody({ ok: 1 }) }]);
    assert.deepEqual((await provider(good.impl).structured(request)).data, { ok: 1 });
    assert.equal(good.calls.length, 2);

    const bad = fakeFetch([{ status: 500, body: {} }, { status: 503, body: {} }, new TypeError('network')]);
    await assert.rejects(provider(bad.impl).structured(request), { code: 'AI_UNAVAILABLE' });
    assert.equal(bad.calls.length, 3);
  });

  test('blocked, truncated and malformed responses', async () => {
    const blocked = fakeFetch([{ body: { promptFeedback: { blockReason: 'SAFETY' } } }]);
    await assert.rejects(provider(blocked.impl).structured(request), { code: 'AI_REFUSED' });

    const safety = fakeFetch([{ body: { candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] } }]);
    await assert.rejects(provider(safety.impl).structured(request), { code: 'AI_REFUSED' });

    const cut = fakeFetch([{ body: { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"a"' }] } }] } }]);
    await assert.rejects(provider(cut.impl).structured(request), { code: 'AI_INVALID_OUTPUT' });

    const junk = fakeFetch([{ body: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not json' }] } }] } }]);
    await assert.rejects(provider(junk.impl).structured(request), { code: 'AI_INVALID_OUTPUT' });
  });

  test('reports itself as a real (non-demo) provider without embeddings', () => {
    const p = provider(async () => {});
    assert.equal(p.name, 'gemini');
    assert.equal(p.isDemo, false);
    assert.equal(p.supportsEmbeddings, false);
    assert.equal(p.label, 'Gemini (gemini-test)');
  });
});
