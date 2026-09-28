/**
 * Official Meta Graph API connector for reference posts.
 *
 *  Facebook  →  GET /{page-id}/posts?fields=id,message,created_time,full_picture,permalink_url
 *               Needs a Page access token with pages_read_engagement for Pages you manage,
 *               or Meta's "Page Public Content Access" feature for other public Pages.
 *
 *  Instagram →  GET /{your-ig-user-id}?fields=business_discovery.username(NAME){media{…}}
 *               Reads public media of any Instagram Business/Creator account. Needs your own
 *               IG Business account id (META_IG_USER_ID) and instagram_basic + pages_read_engagement.
 *
 * Only the official API is used: no scraping, no login emulation, no rate-limit evasion.
 * The token never leaves the server and is never logged.
 */
import { createHmac } from 'node:crypto';
import { env } from '../../config/env.js';

const HOST = 'https://graph.facebook.com';
const TIMEOUT_MS = 15_000;
const USAGE_STOP_PERCENT = 85; // stop paging early when Meta reports we're near a rate limit

export class MetaError extends Error {
  constructor(message, { code, subcode, status } = {}) {
    super(message);
    this.name = 'MetaError';
    this.code = code;
    this.subcode = subcode;
    this.status = status;
  }
}

/** Translates Graph API errors into messages an admin can act on. */
function friendlyError(err, status) {
  const { code, error_subcode: subcode, message = '' } = err || {};
  if (code === 190) return new MetaError('The Meta access token is invalid or has expired. Generate a new long-lived token and update META_ACCESS_TOKEN.', { code, subcode, status });
  if ([4, 17, 32, 613, 80001, 80002].includes(code)) return new MetaError('Meta is rate-limiting requests right now. Try again later.', { code, subcode, status });
  if (code === 10 || (code >= 200 && code < 300)) {
    return new MetaError('The Meta token lacks permission for this account. Pages you don’t manage need Meta’s “Page Public Content Access” feature; Instagram needs instagram_basic and pages_read_engagement.', { code, subcode, status });
  }
  if (code === 100 && subcode === 33) return new MetaError('That Page or account doesn’t exist, or this token can’t see it.', { code, subcode, status });
  if (code === 110 || /business_discovery|professional account|Invalid user id/i.test(message)) {
    return new MetaError('Instagram account not found, or it isn’t a public Business/Creator account (Business Discovery only works for those).', { code, subcode, status });
  }
  return new MetaError(`Meta API error: ${message.slice(0, 200) || 'unknown error'}`, { code, subcode, status });
}

/** Highest usage percentage Meta reports in the rate-limit headers (0 if absent). */
function usagePercent(headers) {
  let max = 0;
  const read = (raw) => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };
  const app = read(headers.get('x-app-usage'));
  if (app) max = Math.max(max, app.call_count || 0, app.total_time || 0, app.total_cputime || 0);
  const buc = read(headers.get('x-business-use-case-usage'));
  if (buc) {
    for (const entries of Object.values(buc)) {
      for (const e of entries || []) max = Math.max(max, e.call_count || 0, e.total_time || 0, e.total_cputime || 0);
    }
  }
  return max;
}

// ── Reference parsing ────────────────────────────────────────

/** Page id or username from an id, "@name", a facebook.com URL, or profile.php?id=… */
export function parseFacebookPageRef(value) {
  const v = String(value || '').trim();
  if (!v) return null;
  if (/^\d{5,}$/.test(v)) return v;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (/(^|\.)facebook\.com$|(^|\.)fb\.com$/i.test(url.hostname)) {
      const id = url.searchParams.get('id');
      if (id && /^\d+$/.test(id)) return id;
      const seg = url.pathname.split('/').filter(Boolean);
      const name = seg[0] === 'pg' ? seg[1] : seg[0];
      if (name && /^[\w.-]{2,}$/.test(name)) return name;
    }
  } catch {
    /* not a URL */
  }
  const name = v.replace(/^@/, '');
  return /^[\w.-]{2,}$/.test(name) ? name : null;
}

/** Instagram username from "@name", "name", or an instagram.com URL. */
export function parseInstagramUsername(value) {
  const v = String(value || '').trim();
  if (!v) return null;
  let name = v.replace(/^@/, '');
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (/(^|\.)instagram\.com$/i.test(url.hostname)) name = url.pathname.split('/').filter(Boolean)[0] || '';
  } catch {
    /* plain username */
  }
  name = name.toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(name) ? name : null;
}

// ── Connector ────────────────────────────────────────────────

export function createMetaConnector({ accessToken, appSecret, igUserId, version, maxPosts = 100, fetchImpl = fetch }) {
  const proof = accessToken && appSecret ? createHmac('sha256', appSecret).update(accessToken).digest('hex') : null;

  async function graph(path, params = {}) {
    if (!accessToken) throw new MetaError('The Meta connector isn’t configured. Set META_ACCESS_TOKEN in .env.');
    const url = new URL(`${HOST}/${version}/${path.replace(/^\//, '')}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set('access_token', accessToken);
    if (proof) url.searchParams.set('appsecret_proof', proof);

    let res;
    try {
      res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'application/json' } });
    } catch (err) {
      throw new MetaError(err?.name === 'TimeoutError' ? 'Meta took too long to respond.' : 'Could not reach the Meta Graph API.');
    }
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.error) throw friendlyError(body?.error, res.status);
    return { body, usage: usagePercent(res.headers) };
  }

  /** Latest posts of a Facebook Page (text posts only are useful for style). */
  async function facebookPosts(ref) {
    const pageRef = parseFacebookPageRef(ref);
    if (!pageRef) throw new MetaError('Enter the Facebook Page ID, username, or page URL.');
    const { body: page } = await graph(pageRef, { fields: 'id,name' });

    const posts = [];
    let after;
    let stoppedEarly = false;
    while (posts.length < maxPosts) {
      const { body, usage } = await graph(`${page.id}/posts`, {
        fields: 'id,message,created_time,full_picture,permalink_url',
        limit: String(Math.min(100, maxPosts - posts.length)),
        ...(after && { after }),
      });
      for (const p of body.data || []) {
        if (!p.message?.trim()) continue;
        posts.push({
          externalPostId: p.id,
          content: p.message.trim().slice(0, 20000),
          imageUrl: p.full_picture || null,
          publishedAt: p.created_time ? new Date(p.created_time).toISOString() : null,
          metadata: { link: p.permalink_url || null, source: 'facebook_graph' },
        });
      }
      after = body.paging?.next ? body.paging?.cursors?.after : null;
      if (!after || !(body.data || []).length) break;
      if (usage >= USAGE_STOP_PERCENT) {
        stoppedEarly = true;
        break;
      }
    }
    return { account: { id: page.id, name: page.name }, posts: posts.slice(0, maxPosts), stoppedEarly };
  }

  /** Public media captions of an Instagram Business/Creator account via Business Discovery. */
  async function instagramMedia(usernameRef) {
    if (!igUserId) {
      throw new MetaError('Set META_IG_USER_ID (your own Instagram Business account id) to read Instagram accounts.');
    }
    const username = parseInstagramUsername(usernameRef);
    if (!username) throw new MetaError('Enter a valid Instagram username.');

    const posts = [];
    let after;
    let account = null;
    let stoppedEarly = false;
    while (posts.length < maxPosts) {
      const pageSize = Math.min(50, maxPosts - posts.length);
      const media = `media.limit(${pageSize})${after ? `.after(${after})` : ''}{id,caption,media_type,media_url,thumbnail_url,permalink,timestamp}`;
      const { body, usage } = await graph(igUserId, { fields: `business_discovery.username(${username}){id,username,name,${media}}` });
      const bd = body.business_discovery;
      if (!bd) throw new MetaError('Instagram account not found, or it isn’t a public Business/Creator account.');
      account = { id: bd.id, name: bd.name || bd.username, username: bd.username };
      for (const m of bd.media?.data || []) {
        if (!m.caption?.trim()) continue;
        posts.push({
          externalPostId: m.id,
          content: m.caption.trim().slice(0, 20000),
          imageUrl: (m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url) || null,
          publishedAt: m.timestamp ? new Date(m.timestamp).toISOString() : null,
          metadata: { link: m.permalink || null, mediaType: m.media_type || null, source: 'instagram_business_discovery' },
        });
      }
      after = bd.media?.paging?.cursors?.after;
      if (!after || !(bd.media?.data || []).length) break;
      if (usage >= USAGE_STOP_PERCENT) {
        stoppedEarly = true;
        break;
      }
    }
    return { account, posts: posts.slice(0, maxPosts), stoppedEarly };
  }

  /** Verifies the token (and the IG account id, if set). */
  async function check() {
    const result = { facebook: false, instagram: false, tokenOwner: null, instagramAccount: null, error: null };
    try {
      const { body } = await graph('me', { fields: 'id,name' });
      result.tokenOwner = body.name || body.id;
      result.facebook = true;
      if (igUserId) {
        const { body: ig } = await graph(igUserId, { fields: 'id,username' });
        result.instagramAccount = ig.username ? `@${ig.username}` : ig.id;
        result.instagram = true;
      }
    } catch (err) {
      result.error = err.message;
    }
    return result;
  }

  return {
    configured: { facebook: !!accessToken, instagram: !!(accessToken && igUserId) },
    version,
    facebookPosts,
    instagramMedia,
    check,
  };
}

let cached;
export function getMetaConnector() {
  cached ??= createMetaConnector({
    accessToken: env.META_ACCESS_TOKEN,
    appSecret: env.META_APP_SECRET,
    igUserId: env.META_IG_USER_ID,
    version: env.META_GRAPH_VERSION,
    maxPosts: env.META_MAX_POSTS_PER_SYNC,
  });
  return cached;
}

/** Test hook. */
export function setMetaConnectorForTesting(connector) {
  cached = connector;
}
