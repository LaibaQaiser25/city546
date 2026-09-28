import { randomBytes } from 'node:crypto';
import { query } from '../config/db.js';
import { open, seal } from '../services/secretBox.js';

/** Public view of a connection — never includes tokens. */
const toConnection = (r) =>
  r && {
    id: r.id,
    provider: r.provider,
    externalUserId: r.external_user_id,
    displayName: r.display_name,
    username: r.username,
    avatarUrl: r.avatar_url,
    scopes: r.scopes,
    status: r.status,
    lastError: r.last_error,
    accessExpiresAt: r.access_expires_at,
    refreshExpiresAt: r.refresh_expires_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };

const addSeconds = (s) => (s ? new Date(Date.now() + Number(s) * 1000) : null);

export async function list(provider) {
  const { rows } = await query('SELECT * FROM platform_connections WHERE provider = $1 ORDER BY created_at', [provider]);
  return rows.map(toConnection);
}

export async function find(id) {
  const { rows } = await query('SELECT * FROM platform_connections WHERE id = $1', [id]);
  return toConnection(rows[0]);
}

/** Decrypted tokens — only for server-side API calls. */
export async function tokens(id) {
  const { rows } = await query('SELECT access_token_enc, refresh_token_enc, access_expires_at, refresh_expires_at FROM platform_connections WHERE id = $1', [id]);
  const r = rows[0];
  if (!r) return null;
  return {
    accessToken: open(r.access_token_enc),
    refreshToken: open(r.refresh_token_enc),
    accessExpiresAt: r.access_expires_at,
    refreshExpiresAt: r.refresh_expires_at,
  };
}

/** Creates or refreshes the connection for a provider user (re-connecting updates tokens). */
export async function upsert({ provider, externalUserId, displayName, username, avatarUrl, scopes, token }) {
  const { rows } = await query(
    `INSERT INTO platform_connections
       (provider, external_user_id, display_name, username, avatar_url, scopes,
        access_token_enc, refresh_token_enc, access_expires_at, refresh_expires_at, status, last_error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', NULL)
     ON CONFLICT (provider, external_user_id) DO UPDATE SET
       display_name = EXCLUDED.display_name, username = EXCLUDED.username, avatar_url = EXCLUDED.avatar_url,
       scopes = EXCLUDED.scopes, access_token_enc = EXCLUDED.access_token_enc,
       refresh_token_enc = EXCLUDED.refresh_token_enc, access_expires_at = EXCLUDED.access_expires_at,
       refresh_expires_at = EXCLUDED.refresh_expires_at, status = 'active', last_error = NULL
     RETURNING *`,
    [
      provider,
      externalUserId,
      displayName || null,
      username || null,
      avatarUrl || null,
      scopes || null,
      seal(token.access_token),
      seal(token.refresh_token),
      addSeconds(token.expires_in),
      addSeconds(token.refresh_expires_in),
    ],
  );
  return toConnection(rows[0]);
}

export async function saveRefreshedTokens(id, token) {
  await query(
    `UPDATE platform_connections
        SET access_token_enc = $2, refresh_token_enc = COALESCE($3, refresh_token_enc),
            access_expires_at = $4, refresh_expires_at = COALESCE($5, refresh_expires_at),
            status = 'active', last_error = NULL
      WHERE id = $1`,
    [id, seal(token.access_token), seal(token.refresh_token), addSeconds(token.expires_in), addSeconds(token.refresh_expires_in)],
  );
}

export async function markReauth(id, message) {
  await query(`UPDATE platform_connections SET status = 'reauth_required', last_error = $2 WHERE id = $1`, [id, String(message).slice(0, 500)]);
}

export async function remove(id) {
  const { rowCount } = await query('DELETE FROM platform_connections WHERE id = $1', [id]);
  return rowCount > 0;
}

// ── OAuth state (CSRF protection, one-time use, 10-minute lifetime) ──
export async function createState(provider, userId) {
  await query("DELETE FROM oauth_states WHERE created_at < NOW() - INTERVAL '1 hour'");
  const state = randomBytes(24).toString('base64url');
  await query('INSERT INTO oauth_states (state, provider, user_id) VALUES ($1, $2, $3)', [state, provider, userId]);
  return state;
}

/** Deletes and returns the state if it is valid for this provider and not expired. */
export async function consumeState(state, provider) {
  if (!state || typeof state !== 'string' || state.length > 64) return null;
  const { rows } = await query(
    `DELETE FROM oauth_states WHERE state = $1 AND provider = $2 RETURNING user_id, created_at > NOW() - INTERVAL '10 minutes' AS fresh`,
    [state, provider],
  );
  return rows[0]?.fresh ? { userId: rows[0].user_id } : null;
}
