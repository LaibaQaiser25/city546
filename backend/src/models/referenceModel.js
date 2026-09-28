import { createHash } from 'node:crypto';
import { query } from '../config/db.js';

const ACCOUNT_COLUMNS = `
  a.id, a.platform, a.account_name, a.profile_url, a.description, a.source_type, a.feed_url,
  a.external_account_id, a.connection_id, a.active, a.last_synced_at, a.last_sync_error, a.created_at, a.updated_at,
  (SELECT COUNT(*) FROM reference_posts p WHERE p.reference_account_id = a.id) AS post_count`;

const toAccount = (r) =>
  r && {
    id: r.id,
    platform: r.platform,
    accountName: r.account_name,
    profileUrl: r.profile_url,
    description: r.description,
    sourceType: r.source_type,
    feedUrl: r.feed_url,
    externalAccountId: r.external_account_id,
    connectionId: r.connection_id,
    active: r.active,
    lastSyncedAt: r.last_synced_at,
    lastSyncError: r.last_sync_error,
    postCount: r.post_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };

export async function listAccounts() {
  const { rows } = await query(`SELECT ${ACCOUNT_COLUMNS} FROM reference_accounts a ORDER BY a.created_at`);
  return rows.map(toAccount);
}

export async function findAccount(id) {
  const { rows } = await query(`SELECT ${ACCOUNT_COLUMNS} FROM reference_accounts a WHERE a.id = $1`, [id]);
  return toAccount(rows[0]);
}

export async function createAccount(a) {
  const { rows } = await query(
    `INSERT INTO reference_accounts (platform, account_name, profile_url, description, source_type, feed_url, external_account_id, active, connection_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [a.platform, a.accountName, a.profileUrl, a.description, a.sourceType, a.feedUrl, a.externalAccountId, a.active, a.connectionId ?? null],
  );
  return findAccount(rows[0].id);
}

export async function updateAccount(id, a) {
  const { rowCount } = await query(
    `UPDATE reference_accounts
        SET platform = $1, account_name = $2, profile_url = $3, description = $4, source_type = $5,
            feed_url = $6, external_account_id = $7, active = $8, connection_id = $10
      WHERE id = $9`,
    [a.platform, a.accountName, a.profileUrl, a.description, a.sourceType, a.feedUrl, a.externalAccountId, a.active, id, a.connectionId ?? null],
  );
  return rowCount ? findAccount(id) : null;
}

export async function deleteAccount(id) {
  const { rowCount } = await query('DELETE FROM reference_accounts WHERE id = $1', [id]);
  return rowCount > 0;
}

export async function recordSync(id, error = null) {
  await query(
    `UPDATE reference_accounts SET last_synced_at = CASE WHEN $2::text IS NULL THEN NOW() ELSE last_synced_at END,
            last_sync_error = $2 WHERE id = $1`,
    [id, error],
  );
}

// ── Posts ──
export const hashContent = (content) =>
  createHash('sha256').update(content.replace(/\s+/g, ' ').trim().toLowerCase()).digest('hex');

/** Inserts posts, skipping duplicates. Returns the number actually added. */
export async function insertPosts(accountId, posts) {
  let added = 0;
  for (const p of posts) {
    const { rowCount } = await query(
      `INSERT INTO reference_posts (reference_account_id, external_post_id, content, content_hash, image_url, published_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT DO NOTHING`,
      [accountId, p.externalPostId || null, p.content, hashContent(p.content), p.imageUrl || null, p.publishedAt || null, JSON.stringify(p.metadata || {})],
    );
    added += rowCount;
  }
  return added;
}

export async function listPosts(accountId, { page = 1, limit = 20 } = {}) {
  const [rows, count] = await Promise.all([
    query(
      `SELECT id, external_post_id, content, image_url, published_at, metadata, created_at
         FROM reference_posts WHERE reference_account_id = $1
        ORDER BY published_at DESC NULLS LAST, id DESC LIMIT $2 OFFSET $3`,
      [accountId, limit, (page - 1) * limit],
    ),
    query('SELECT COUNT(*) AS total FROM reference_posts WHERE reference_account_id = $1', [accountId]),
  ]);
  const total = count.rows[0].total;
  return {
    posts: rows.rows.map((r) => ({
      id: r.id,
      externalPostId: r.external_post_id,
      content: r.content,
      imageUrl: r.image_url,
      publishedAt: r.published_at,
      metadata: r.metadata,
      createdAt: r.created_at,
    })),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function deletePost(accountId, postId) {
  const { rowCount } = await query('DELETE FROM reference_posts WHERE id = $1 AND reference_account_id = $2', [postId, accountId]);
  return rowCount > 0;
}

// ── Style-analysis inputs ──

/** Fingerprint of all active reference posts — changes whenever the dataset changes. */
export async function currentFingerprint() {
  const { rows } = await query(`
    SELECT md5(COALESCE(string_agg(p.id::text || ':' || p.content_hash, ',' ORDER BY p.id), '')) AS fp,
           COUNT(p.id) AS posts, COUNT(DISTINCT a.id) AS accounts
      FROM reference_posts p JOIN reference_accounts a ON a.id = p.reference_account_id
     WHERE a.active`);
  return rows[0];
}

/**
 * A balanced sample for analysis: newest posts first, spread evenly across active accounts,
 * capped by count and by total characters so the request stays a sensible size.
 */
export async function sampleForAnalysis(maxPosts, maxChars = 120_000) {
  const { rows } = await query(
    `SELECT p.content, a.platform, a.id AS account_id
       FROM (
         SELECT p.*, ROW_NUMBER() OVER (PARTITION BY p.reference_account_id
                                        ORDER BY p.published_at DESC NULLS LAST, p.id DESC) AS rn
           FROM reference_posts p
       ) p
       JOIN reference_accounts a ON a.id = p.reference_account_id
      WHERE a.active
      ORDER BY p.rn, a.id
      LIMIT $1`,
    [maxPosts],
  );
  const out = [];
  let chars = 0;
  for (const r of rows) {
    const content = r.content.length > 2500 ? `${r.content.slice(0, 2500)}…` : r.content;
    if (chars + content.length > maxChars) break;
    chars += content.length;
    out.push({ content, platform: r.platform });
  }
  return out;
}

/**
 * Retrieval: reference posts most relevant to the admin's notes (PostgreSQL full-text rank),
 * topped up with recent posts so there are always a few representative examples.
 */
export async function relevantExamples(text, limit) {
  if (limit <= 0) return [];
  const terms = [...new Set(String(text).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])].slice(0, 30);
  let rows = [];
  if (terms.length) {
    ({ rows } = await query(
      `SELECT p.id, p.content, ts_rank(p.search_vector, q) AS rank
         FROM reference_posts p
         JOIN reference_accounts a ON a.id = p.reference_account_id AND a.active,
              to_tsquery('simple', $1) q
        WHERE p.search_vector @@ q
        ORDER BY rank DESC, p.published_at DESC NULLS LAST
        LIMIT $2`,
      [terms.map((t) => t.replace(/'/g, "''")).map((t) => `'${t}'`).join(' | '), limit],
    ));
  }
  if (rows.length < limit) {
    const seen = rows.map((r) => r.id);
    const { rows: more } = await query(
      `SELECT p.id, p.content FROM reference_posts p
         JOIN reference_accounts a ON a.id = p.reference_account_id AND a.active
        WHERE NOT (p.id = ANY($1::bigint[]))
        ORDER BY p.published_at DESC NULLS LAST, p.id DESC
        LIMIT $2`,
      [seen, limit - rows.length],
    );
    rows = rows.concat(more);
  }
  return rows.map((r) => ({ id: r.id, content: r.content.length > 1200 ? `${r.content.slice(0, 1200)}…` : r.content }));
}
