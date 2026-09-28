/**
 * Meta (Facebook / Instagram) connector tests — use a fake Graph API, no credentials or network.
 */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

process.env.NODE_ENV = 'test';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/config/db.js');
const { createMetaConnector, parseFacebookPageRef, parseInstagramUsername, setMetaConnectorForTesting } = await import(
  '../src/ai/connectors/metaConnector.js'
);
const AI = await import('../src/models/aiModel.js');

const json = (body, { status = 200, headers = {} } = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

/** Minimal fake of the Graph API endpoints the connector uses. Records every request URL. */
function fakeGraph({ usage = 0, errorFor } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    const u = new URL(url);
    calls.push(u);
    const path = u.pathname.replace(/^\/v\d+\.\d+\//, '');
    const fields = u.searchParams.get('fields') || '';
    if (errorFor && errorFor(path, fields)) return json({ error: errorFor(path, fields) }, { status: 400 });
    const headers = { 'x-app-usage': JSON.stringify({ call_count: usage, total_time: 1, total_cputime: 1 }) };

    if (path === 'me') return json({ id: '1', name: 'City546 System User' }, { headers });
    if (path === 'citynews') return json({ id: '555', name: 'City News' }, { headers });
    if (path === '555/posts') {
      const after = u.searchParams.get('after');
      if (!after) {
        return json({
          data: [
            { id: '555_1', message: 'پہلی خبر: شہر میں نئی سڑک کا افتتاح', created_time: '2026-09-01T10:00:00+0000', full_picture: 'https://scontent.example/1.jpg', permalink_url: 'https://facebook.com/555_1' },
            { id: '555_2', created_time: '2026-09-01T09:00:00+0000' }, // photo-only post: skipped
          ],
          paging: { cursors: { after: 'CUR1' }, next: 'https://graph.facebook.com/next' },
        }, { headers });
      }
      return json({ data: [{ id: '555_3', message: 'Second page post', created_time: '2026-08-30T10:00:00+0000' }], paging: { cursors: { after: 'CUR2' } } }, { headers });
    }
    if (path === '1789' && fields.startsWith('business_discovery')) {
      const page2 = fields.includes('.after(IGCUR)');
      return json({
        business_discovery: {
          id: '99', username: 'local_news', name: 'Local News',
          media: page2
            ? { data: [{ id: 'm3', caption: 'Third caption', media_type: 'IMAGE', media_url: 'https://cdn.example/3.jpg', timestamp: '2026-08-01T00:00:00+0000' }] }
            : {
                data: [
                  { id: 'm1', caption: 'اہم خبر — پہلی پوسٹ #News', media_type: 'IMAGE', media_url: 'https://cdn.example/1.jpg', permalink: 'https://instagram.com/p/1', timestamp: '2026-09-02T00:00:00+0000' },
                  { id: 'm2', caption: 'Video caption', media_type: 'VIDEO', thumbnail_url: 'https://cdn.example/2-thumb.jpg', timestamp: '2026-09-01T00:00:00+0000' },
                ],
                paging: { cursors: { after: 'IGCUR' } },
              },
        },
        id: '1789',
      }, { headers });
    }
    if (path === '1789') return json({ id: '1789', username: 'city546_official' }, { headers });
    return json({ error: { message: 'Unsupported get request', code: 100, error_subcode: 33 } }, { status: 400 });
  };
  return { fetchImpl, calls };
}

const make = (opts = {}) =>
  createMetaConnector({ accessToken: 'TOKEN123', appSecret: 'SECRET', igUserId: '1789', version: 'v26.0', maxPosts: 100, ...opts });

describe('reference parsing', () => {
  test('Facebook page refs', () => {
    assert.equal(parseFacebookPageRef('https://www.facebook.com/citynews'), 'citynews');
    assert.equal(parseFacebookPageRef('facebook.com/profile.php?id=123456789'), '123456789');
    assert.equal(parseFacebookPageRef('@citynews'), 'citynews');
    assert.equal(parseFacebookPageRef('1234567890'), '1234567890');
    assert.equal(parseFacebookPageRef('bad name!'), null);
  });
  test('Instagram usernames', () => {
    assert.equal(parseInstagramUsername('@Local_News'), 'local_news');
    assert.equal(parseInstagramUsername('https://www.instagram.com/local.news/'), 'local.news');
    assert.equal(parseInstagramUsername('no spaces allowed'), null);
  });
});

describe('Facebook Page posts', () => {
  test('paginates, skips text-less posts, maps fields, signs requests', async () => {
    const { fetchImpl, calls } = fakeGraph();
    const res = await make({ fetchImpl }).facebookPosts('https://facebook.com/citynews');
    assert.deepEqual(res.account, { id: '555', name: 'City News' });
    assert.equal(res.posts.length, 2);
    assert.equal(res.posts[0].externalPostId, '555_1');
    assert.equal(res.posts[0].imageUrl, 'https://scontent.example/1.jpg');
    assert.equal(res.posts[0].metadata.link, 'https://facebook.com/555_1');
    assert.equal(calls[2].searchParams.get('after'), 'CUR1');
    // appsecret_proof = HMAC-SHA256(token, app secret)
    assert.equal(calls[0].searchParams.get('appsecret_proof'), createHmac('sha256', 'SECRET').update('TOKEN123').digest('hex'));
    assert.equal(calls[0].pathname.startsWith('/v26.0/'), true);
  });

  test('stops paging early near the rate limit', async () => {
    const { fetchImpl, calls } = fakeGraph({ usage: 95 });
    const res = await make({ fetchImpl }).facebookPosts('citynews');
    assert.equal(res.stoppedEarly, true);
    assert.equal(calls.length, 2); // page lookup + first page only
  });

  test('friendly errors for expired tokens and missing permissions', async () => {
    const expired = fakeGraph({ errorFor: () => ({ message: 'Error validating access token', code: 190 }) });
    await assert.rejects(make({ fetchImpl: expired.fetchImpl }).facebookPosts('citynews'), /invalid or has expired/);
    const perm = fakeGraph({ errorFor: () => ({ message: 'Requires pages_read_engagement', code: 10 }) });
    await assert.rejects(make({ fetchImpl: perm.fetchImpl }).facebookPosts('citynews'), /Page Public Content Access/);
  });

  test('not configured → clear message', async () => {
    await assert.rejects(make({ accessToken: undefined }).facebookPosts('citynews'), /META_ACCESS_TOKEN/);
  });
});

describe('Instagram Business Discovery', () => {
  test('reads captions across pages; video uses thumbnail', async () => {
    const { fetchImpl, calls } = fakeGraph();
    const res = await make({ fetchImpl }).instagramMedia('@local_news');
    assert.equal(res.account.username, 'local_news');
    assert.equal(res.posts.length, 3);
    assert.equal(res.posts[1].imageUrl, 'https://cdn.example/2-thumb.jpg');
    assert.match(calls[0].searchParams.get('fields'), /^business_discovery\.username\(local_news\)\{.*media\.limit\(50\)\{/);
    assert.match(calls[1].searchParams.get('fields'), /\.after\(IGCUR\)/);
  });

  test('requires META_IG_USER_ID', async () => {
    await assert.rejects(make({ igUserId: undefined }).instagramMedia('local_news'), /META_IG_USER_ID/);
  });

  test('check() reports token owner and IG account', async () => {
    const { fetchImpl } = fakeGraph();
    const res = await make({ fetchImpl }).check();
    assert.equal(res.facebook, true);
    assert.equal(res.instagram, true);
    assert.equal(res.instagramAccount, '@city546_official');
  });
});

describe('API: sync through the connector', () => {
  let server;
  let base;
  let cookie;
  const accountIds = [];
  let priorSettings;

  before(async () => {
    setMetaConnectorForTesting(make({ fetchImpl: fakeGraph().fetchImpl }));
    priorSettings = await AI.getSettings();
    await AI.saveSettings({ ...priorSettings, autoRebuild: false });
    server = createApp().listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}/api`;
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
    });
    cookie = res.headers.getSetCookie().find((c) => c.startsWith('city546_token=')).split(';')[0];
  });

  after(async () => {
    for (const id of accountIds) await pool.query('DELETE FROM reference_accounts WHERE id = $1', [id]);
    await AI.saveSettings(priorSettings);
    server?.close();
    await pool.end();
  });

  const api = async (method, path, body) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { Cookie: cookie, ...(body && { 'Content-Type': 'application/json' }) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json() };
  };

  test('connector status is admin-only and reveals no secrets', async () => {
    assert.equal((await fetch(`${base}/reference-accounts/connectors`)).status, 401);
    const { json: body } = await api('GET', '/reference-accounts/connectors');
    assert.deepEqual(body.data.meta, { facebook: true, instagram: true, version: 'v26.0' });
    assert.equal(JSON.stringify(body).includes('TOKEN123'), false);
  });

  test('api source only for Facebook/Instagram', async () => {
    const res = await api('POST', '/reference-accounts', { platform: 'youtube', accountName: 'x', sourceType: 'api' });
    assert.equal(res.status, 400);
  });

  test('Facebook and Instagram accounts sync via the official API', async () => {
    const fb = await api('POST', '/reference-accounts', { platform: 'facebook', accountName: `QA Page ${Date.now()}`, externalAccountId: 'citynews', sourceType: 'api' });
    assert.equal(fb.status, 201);
    accountIds.push(fb.json.data.id);
    const s1 = await api('POST', `/reference-accounts/${fb.json.data.id}/sync`);
    assert.equal(s1.status, 200);
    assert.equal(s1.json.data.added, 2);
    const again = await api('POST', `/reference-accounts/${fb.json.data.id}/sync`);
    assert.equal(again.json.data.added, 0, 're-sync deduplicates');

    const ig = await api('POST', '/reference-accounts', { platform: 'instagram', accountName: `@local_news`, sourceType: 'api' });
    assert.equal(ig.status, 201);
    accountIds.push(ig.json.data.id);
    const s2 = await api('POST', `/reference-accounts/${ig.json.data.id}/sync`);
    assert.equal(s2.json.data.added, 3);
  });

  test('connector errors are recorded on the account', async () => {
    setMetaConnectorForTesting(make({ fetchImpl: fakeGraph({ errorFor: () => ({ message: 'expired', code: 190 }) }).fetchImpl }));
    const res = await api('POST', `/reference-accounts/${accountIds[0]}/sync`);
    assert.equal(res.status, 400);
    assert.match(res.json.error.message, /expired/);
    const list = await api('GET', '/reference-accounts');
    assert.match(list.json.data.find((a) => a.id === accountIds[0]).lastSyncError, /expired/);
  });
});
