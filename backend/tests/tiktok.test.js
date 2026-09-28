/**
 * TikTok connector tests — fake TikTok API, no credentials or network.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

process.env.NODE_ENV = 'test';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/config/db.js');
const { createTikTokConnector, setTikTokConnectorForTesting } = await import('../src/ai/connectors/tiktokConnector.js');
const { seal, open } = await import('../src/services/secretBox.js');
const AI = await import('../src/models/aiModel.js');

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function fakeTikTok() {
  const state = { refreshFails: false, calls: [], revoked: [], bearer: [] };
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    state.calls.push(u.pathname);
    if (init.headers?.Authorization) state.bearer.push(init.headers.Authorization);
    if (u.pathname === '/v2/oauth/token/') {
      const form = new URLSearchParams(init.body);
      if (form.get('grant_type') === 'authorization_code') {
        if (form.get('code') === 'bad') return json({ error: 'invalid_grant', error_description: 'Authorization code is expired.' }, 400);
        return json({
          access_token: 'ACCESS1', expires_in: 86400, refresh_token: 'REFRESH1', refresh_expires_in: 31536000,
          open_id: 'open-qa-123', token_type: 'Bearer',
          scope: form.get('code') === 'noscope' ? 'user.info.basic' : 'user.info.basic,video.list',
        });
      }
      if (form.get('grant_type') === 'refresh_token') {
        if (state.refreshFails) return json({ error: 'invalid_grant', error_description: 'Refresh token is invalid.' }, 400);
        return json({ access_token: 'ACCESS2', expires_in: 86400, refresh_token: 'REFRESH2', refresh_expires_in: 31536000, open_id: 'open-qa-123', scope: 'user.info.basic,video.list' });
      }
    }
    if (u.pathname === '/v2/oauth/revoke/') {
      state.revoked.push(new URLSearchParams(init.body).get('token'));
      return json({});
    }
    if (u.pathname === '/v2/user/info/') return json({ data: { user: { open_id: 'open-qa-123', display_name: 'City 546 News' } }, error: { code: 'ok' } });
    if (u.pathname === '/v2/video/list/') {
      const body = JSON.parse(init.body);
      if (body.cursor == null) {
        return json({
          data: {
            videos: [
              { id: 'v1', video_description: 'اہم خبر: شہر میں نئی سڑک #City546', create_time: 1788000000, cover_image_url: 'https://p16.example/1.jpg', share_url: 'https://tiktok.com/@c/video/v1' },
              { id: 'v2', video_description: '', title: '' }, // no text → skipped
            ],
            cursor: 1787000000, has_more: true,
          },
          error: { code: 'ok' },
        });
      }
      return json({ data: { videos: [{ id: 'v3', title: 'Evening bulletin highlights', create_time: 1786000000 }], has_more: false }, error: { code: 'ok' } });
    }
    return json({ error: { code: 'not_found', message: 'unknown' } }, 404);
  };
  return { state, fetchImpl };
}

describe('secretBox', () => {
  test('round-trips and detects tampering', () => {
    const sealed = seal('secret-token');
    assert.match(sealed, /^v1:/);
    assert.equal(sealed.includes('secret-token'), false);
    assert.equal(open(sealed), 'secret-token');
    const [v, iv, tag, data] = sealed.split(':');
    const flipped = Buffer.from(data, 'base64');
    flipped[0] ^= 1;
    assert.throws(() => open([v, iv, tag, flipped.toString('base64')].join(':')));
  });
});

describe('TikTok OAuth + sync (API)', () => {
  let server;
  let base;
  let cookie;
  let fake;
  let connectionId;
  let accountId;
  let priorSettings;

  before(async () => {
    fake = fakeTikTok();
    setTikTokConnectorForTesting(
      createTikTokConnector({ clientKey: 'ck', clientSecret: 'cs', redirectUri: 'https://example.test/api/oauth/tiktok/callback', maxPosts: 100, fetchImpl: fake.fetchImpl }),
    );
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
    if (accountId) await pool.query('DELETE FROM reference_accounts WHERE id = $1', [accountId]);
    await pool.query("DELETE FROM platform_connections WHERE external_user_id = 'open-qa-123'");
    await AI.saveSettings(priorSettings);
    server?.close();
    await pool.end();
  });

  const api = async (method, path, body) => {
    const res = await fetch(`${base}${path}`, {
      method,
      redirect: 'manual',
      headers: { Cookie: cookie, ...(body && { 'Content-Type': 'application/json' }) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, location: res.headers.get('location'), json: await res.json().catch(() => null) };
  };
  // The callback is hit by the browser WITHOUT the admin cookie (SameSite=Strict).
  const callback = (qs) => fetch(`${base}/oauth/tiktok/callback?${new URLSearchParams(qs)}`, { redirect: 'manual' });
  const authorize = async () => new URL((await api('POST', '/reference-accounts/connectors/tiktok/authorize')).json.data.url).searchParams.get('state');

  test('authorize is admin-only and builds the consent URL', async () => {
    assert.equal((await fetch(`${base}/reference-accounts/connectors/tiktok/authorize`, { method: 'POST' })).status, 401);
    const res = await api('POST', '/reference-accounts/connectors/tiktok/authorize');
    const url = new URL(res.json.data.url);
    assert.equal(url.origin + url.pathname, 'https://www.tiktok.com/v2/auth/authorize/');
    assert.equal(url.searchParams.get('client_key'), 'ck');
    assert.equal(url.searchParams.get('scope'), 'user.info.basic,video.list');
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.ok(url.searchParams.get('state').length >= 32);
  });

  test('callback rejects unknown state (CSRF) and never follows external redirects', async () => {
    const res = await callback({ code: 'good', state: 'forged-state' });
    assert.equal(res.status, 303);
    assert.match(res.headers.get('location'), /^\/admin\/ai-style\?tiktok=error/);
  });

  test('callback rejects a connection without the video.list scope and revokes it', async () => {
    const res = await callback({ code: 'noscope', state: await authorize() });
    assert.match(res.headers.get('location'), /tiktok=error/);
    assert.ok(fake.state.revoked.includes('ACCESS1'));
  });

  test('successful connection stores tokens encrypted; state is one-time', async () => {
    const state = await authorize();
    const res = await callback({ code: 'good', state, scopes: 'user.info.basic,video.list' });
    assert.equal(res.headers.get('location'), '/admin/ai-style?tiktok=connected');

    const { rows } = await pool.query("SELECT * FROM platform_connections WHERE external_user_id = 'open-qa-123'");
    assert.equal(rows.length, 1);
    connectionId = rows[0].id;
    assert.equal(rows[0].display_name, 'City 546 News');
    assert.equal(rows[0].access_token_enc.includes('ACCESS1'), false, 'token not stored in plaintext');
    assert.equal(open(rows[0].access_token_enc), 'ACCESS1');

    const reuse = await callback({ code: 'good', state });
    assert.match(reuse.headers.get('location'), /tiktok=error/, 'state cannot be replayed');

    const { json: status } = await api('GET', '/reference-accounts/connectors');
    assert.equal(status.data.tiktok.configured, true);
    const conn = status.data.tiktok.connections.find((c) => c.id === connectionId);
    assert.equal(conn.displayName, 'City 546 News');
    assert.equal(JSON.stringify(status).includes('ACCESS1'), false, 'no tokens in API responses');
  });

  test('database refuses plaintext tokens', async () => {
    await assert.rejects(
      pool.query("INSERT INTO platform_connections (provider, external_user_id, access_token_enc) VALUES ('tiktok', 'x', 'plain-token')"),
      /platform_connections_access_encrypted/,
    );
  });

  test('TikTok reference account requires a connection, then syncs videos', async () => {
    assert.equal((await api('POST', '/reference-accounts', { platform: 'tiktok', accountName: '@qa_tt', sourceType: 'api' })).status, 400);
    const created = await api('POST', '/reference-accounts', { platform: 'tiktok', accountName: `@qa_tt_${Date.now()}`, sourceType: 'api', connectionId });
    assert.equal(created.status, 201);
    accountId = created.json.data.id;

    const sync = await api('POST', `/reference-accounts/${accountId}/sync`);
    assert.equal(sync.status, 200);
    assert.equal(sync.json.data.added, 2, 'two videos with text across two pages');
    assert.ok(fake.state.bearer.includes('Bearer ACCESS1'));
  });

  test('expired access token is refreshed automatically', async () => {
    await pool.query("UPDATE platform_connections SET access_expires_at = NOW() - INTERVAL '1 hour' WHERE id = $1", [connectionId]);
    const sync = await api('POST', `/reference-accounts/${accountId}/sync`);
    assert.equal(sync.status, 200);
    assert.ok(fake.state.bearer.includes('Bearer ACCESS2'));
    const { rows } = await pool.query('SELECT access_token_enc, refresh_token_enc FROM platform_connections WHERE id = $1', [connectionId]);
    assert.equal(open(rows[0].access_token_enc), 'ACCESS2');
    assert.equal(open(rows[0].refresh_token_enc), 'REFRESH2');
  });

  test('failed refresh marks the connection for reconnection', async () => {
    fake.state.refreshFails = true;
    await pool.query("UPDATE platform_connections SET access_expires_at = NOW() - INTERVAL '1 hour' WHERE id = $1", [connectionId]);
    const sync = await api('POST', `/reference-accounts/${accountId}/sync`);
    assert.equal(sync.status, 400);
    assert.match(sync.json.error.message, /Reconnect/);
    const { json } = await api('GET', '/reference-accounts/connectors');
    assert.equal(json.data.tiktok.connections.find((c) => c.id === connectionId).status, 'reauth_required');
    fake.state.refreshFails = false;
  });

  test('disconnect revokes at TikTok and unlinks reference accounts', async () => {
    fake.state.revoked.length = 0;
    const res = await api('DELETE', `/reference-accounts/connectors/tiktok/${connectionId}`);
    assert.equal(res.status, 200);
    assert.equal(fake.state.revoked.length, 1);
    const { rows } = await pool.query('SELECT connection_id FROM reference_accounts WHERE id = $1', [accountId]);
    assert.equal(rows[0].connection_id, null);
  });
});
