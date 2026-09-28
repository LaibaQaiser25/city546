/**
 * TikTok connection lifecycle: OAuth start/finish, encrypted token storage,
 * automatic refresh (access tokens last 24 h), sync and disconnect.
 */
import * as Conn from '../../models/connectionModel.js';
import { getTikTokConnector, TikTokError } from './tiktokConnector.js';

const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const refreshing = new Map(); // connectionId → Promise (single-flight refresh)

export async function startAuthorization(userId) {
  const tt = getTikTokConnector();
  if (!tt.configured) throw new TikTokError('The TikTok connector isn’t configured on the server.');
  const state = await Conn.createState('tiktok', userId);
  return tt.authorizeUrl(state);
}

/**
 * Handles the OAuth redirect. The one-time `state` proves the flow was started by the
 * signed-in Admin (the auth cookie is SameSite=Strict, so it isn't sent on this redirect).
 */
export async function completeAuthorization({ code, state, error, errorDescription }) {
  const valid = await Conn.consumeState(state, 'tiktok');
  if (!valid) return { ok: false, message: 'This TikTok authorisation link is invalid or has expired. Please try again.' };
  if (error) return { ok: false, message: errorDescription || 'TikTok authorisation was cancelled.' };
  if (!code) return { ok: false, message: 'TikTok did not return an authorisation code.' };

  const tt = getTikTokConnector();
  try {
    const token = await tt.exchangeCode(code);
    const granted = String(token.scope || '').split(',');
    if (!granted.includes('video.list')) {
      await tt.revoke(token.access_token);
      return { ok: false, message: 'Permission to read videos (video.list) wasn’t granted. Please reconnect and allow it.' };
    }
    const user = await tt.userInfo(token.access_token).catch(() => ({}));
    const connection = await Conn.upsert({
      provider: 'tiktok',
      externalUserId: token.open_id || user.open_id,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      scopes: token.scope,
      token,
    });
    return { ok: true, connection };
  } catch (err) {
    return { ok: false, message: err instanceof TikTokError ? err.message : 'Could not complete the TikTok connection.' };
  }
}

/** A valid access token, refreshing it first when it is about to expire. */
async function accessTokenFor(connectionId) {
  const t = await Conn.tokens(connectionId);
  if (!t) throw new TikTokError('This TikTok connection no longer exists. Connect the account again.', { reauth: true });
  const expiresSoon = !t.accessExpiresAt || new Date(t.accessExpiresAt).getTime() - Date.now() < REFRESH_MARGIN_MS;
  if (!expiresSoon) return t.accessToken;
  if (!t.refreshToken) throw new TikTokError('The TikTok authorisation has expired. Reconnect the account.', { reauth: true });

  if (!refreshing.has(connectionId)) {
    refreshing.set(
      connectionId,
      getTikTokConnector()
        .refresh(t.refreshToken)
        .then(async (token) => {
          await Conn.saveRefreshedTokens(connectionId, token);
          return token.access_token;
        })
        .finally(() => refreshing.delete(connectionId)),
    );
  }
  return refreshing.get(connectionId);
}

/** Pulls the connected account's public videos as reference posts. */
export async function fetchPosts(connectionId) {
  if (!connectionId) throw new TikTokError('Choose a connected TikTok account for this reference account.');
  try {
    const token = await accessTokenFor(connectionId);
    return await getTikTokConnector().listVideos(token);
  } catch (err) {
    if (err instanceof TikTokError && err.reauth) await Conn.markReauth(connectionId, err.message).catch(() => {});
    throw err;
  }
}

export async function disconnect(connectionId) {
  const t = await Conn.tokens(connectionId).catch(() => null);
  if (t?.accessToken) await getTikTokConnector().revoke(t.accessToken);
  return Conn.remove(connectionId);
}
