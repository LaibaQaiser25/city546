/**
 * Official TikTok connector — Login Kit (OAuth 2.0) + Display API.
 *
 * TikTok's Display API returns the public videos of accounts that AUTHORISE this app
 * (scope video.list) — e.g. your own channel's TikTok. Reading arbitrary other accounts
 * requires the Research API, which TikTok restricts to approved non-commercial academic
 * research, so it is intentionally not used here. For other accounts, upload an export.
 *
 *   Authorise:  https://www.tiktok.com/v2/auth/authorize/
 *   Tokens:     POST https://open.tiktokapis.com/v2/oauth/token/   (access 24 h, refresh 365 d)
 *   Revoke:     POST https://open.tiktokapis.com/v2/oauth/revoke/
 *   User info:  GET  https://open.tiktokapis.com/v2/user/info/?fields=…
 *   Videos:     POST https://open.tiktokapis.com/v2/video/list/?fields=…  { max_count ≤ 20, cursor }
 */
import { env } from '../../config/env.js';

const AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const API = 'https://open.tiktokapis.com/v2';
export const TIKTOK_SCOPES = ['user.info.basic', 'video.list'];
const TIMEOUT_MS = 15_000;

export class TikTokError extends Error {
  constructor(message, { code, reauth = false } = {}) {
    super(message);
    this.name = 'TikTokError';
    this.code = code;
    this.reauth = reauth; // true → the connection must be re-authorised
  }
}

function friendly(code, description) {
  switch (code) {
    case 'access_token_invalid':
    case 'invalid_grant':
    case 'invalid_token':
      return new TikTokError('The TikTok authorisation has expired or was revoked. Reconnect the account.', { code, reauth: true });
    case 'scope_not_authorized':
    case 'scope_permission_missed':
      return new TikTokError('The TikTok account didn’t grant permission to read videos. Reconnect and allow “video.list”.', { code, reauth: true });
    case 'rate_limit_exceeded':
      return new TikTokError('TikTok is rate-limiting requests right now. Try again later.', { code });
    case 'invalid_client':
    case 'unauthorized_client':
      return new TikTokError('TikTok rejected the app credentials. Check TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET.', { code });
    default:
      return new TikTokError(`TikTok API error: ${String(description || code || 'unknown error').slice(0, 200)}`, { code });
  }
}

export function createTikTokConnector({ clientKey, clientSecret, redirectUri, maxPosts = 100, fetchImpl = fetch }) {
  const configured = !!(clientKey && clientSecret && redirectUri);

  const call = async (url, init) => {
    try {
      return await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      throw new TikTokError(err?.name === 'TimeoutError' ? 'TikTok took too long to respond.' : 'Could not reach the TikTok API.');
    }
  };

  /** OAuth token endpoint (form-encoded). */
  async function tokenRequest(fields) {
    if (!configured) throw new TikTokError('The TikTok connector isn’t configured. Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET and TIKTOK_REDIRECT_URI.');
    const res = await call(`${API}/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
      body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, ...fields }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || body.error || !body.access_token) {
      throw friendly(body?.error || `http_${res.status}`, body?.error_description);
    }
    return body;
  }

  /** Authenticated Display API call; TikTok returns error.code === 'ok' on success. */
  async function api(path, accessToken, { method = 'GET', body } = {}) {
    const res = await call(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, ...(body && { 'Content-Type': 'application/json' }) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    const code = json?.error?.code;
    if (!res.ok || (code && code !== 'ok')) throw friendly(code || `http_${res.status}`, json?.error?.message);
    return json.data || {};
  }

  return {
    configured,
    scopes: TIKTOK_SCOPES,

    authorizeUrl(state) {
      const url = new URL(AUTH_URL);
      url.searchParams.set('client_key', clientKey);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', TIKTOK_SCOPES.join(','));
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('state', state);
      return url.toString();
    },

    exchangeCode: (code) => tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
    refresh: (refreshToken) => tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken }),

    async revoke(accessToken) {
      if (!configured || !accessToken) return;
      await call(`${API}/oauth/revoke/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, token: accessToken }),
      }).catch(() => {});
    },

    async userInfo(accessToken) {
      const data = await api('/user/info/?fields=open_id,display_name,avatar_url', accessToken);
      return data.user || {};
    },

    /** The authorised account's public videos → reference posts (description text only). */
    async listVideos(accessToken) {
      const posts = [];
      let cursor;
      for (let page = 0; page < 20 && posts.length < maxPosts; page += 1) {
        const data = await api('/video/list/?fields=id,title,video_description,create_time,cover_image_url,share_url', accessToken, {
          method: 'POST',
          body: { max_count: 20, ...(cursor != null && { cursor }) },
        });
        for (const v of data.videos || []) {
          const content = (v.video_description || v.title || '').trim();
          if (!content) continue;
          posts.push({
            externalPostId: String(v.id),
            content: content.slice(0, 20000),
            imageUrl: v.cover_image_url || null,
            publishedAt: v.create_time ? new Date(Number(v.create_time) * 1000).toISOString() : null,
            metadata: { link: v.share_url || null, source: 'tiktok_display_api' },
          });
        }
        if (!data.has_more || !(data.videos || []).length) break;
        cursor = data.cursor;
      }
      return posts.slice(0, maxPosts);
    },
  };
}

let cached;
export function getTikTokConnector() {
  cached ??= createTikTokConnector({
    clientKey: env.TIKTOK_CLIENT_KEY,
    clientSecret: env.TIKTOK_CLIENT_SECRET,
    redirectUri: env.TIKTOK_REDIRECT_URI,
    maxPosts: env.TIKTOK_MAX_POSTS_PER_SYNC,
  });
  return cached;
}

/** Test hook. */
export function setTikTokConnectorForTesting(connector) {
  cached = connector;
}
