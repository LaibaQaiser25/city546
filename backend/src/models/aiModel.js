import { query, withTransaction } from '../config/db.js';

// ── Style profiles ──
const toProfile = (r) =>
  r && {
    id: r.id,
    name: r.name,
    version: r.version,
    status: r.status,
    error: r.error,
    isActive: r.is_active,
    profile: r.profile_data,
    sourcePostCount: r.source_post_count,
    sourceAccountCount: r.source_account_count,
    sourceFingerprint: r.source_fingerprint,
    provider: r.provider,
    model: r.model,
    lastGeneratedAt: r.last_generated_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };

export async function activeProfile() {
  const { rows } = await query('SELECT * FROM ai_style_profiles WHERE is_active');
  return toProfile(rows[0]);
}

export async function latestProfile() {
  const { rows } = await query('SELECT * FROM ai_style_profiles ORDER BY version DESC LIMIT 1');
  return toProfile(rows[0]);
}

export async function listProfileVersions(limit = 10) {
  const { rows } = await query(
    `SELECT id, version, status, is_active, source_post_count, source_account_count, provider, model, error, last_generated_at, created_at
       FROM ai_style_profiles ORDER BY version DESC LIMIT $1`,
    [limit],
  );
  return rows.map(toProfile);
}

export async function startProfileBuild({ provider, model }) {
  const { rows } = await query(
    `INSERT INTO ai_style_profiles (version, status, provider, model)
     VALUES ((SELECT COALESCE(MAX(version), 0) + 1 FROM ai_style_profiles), 'building', $1, $2)
     RETURNING *`,
    [provider, model],
  );
  return toProfile(rows[0]);
}

/** Marks a build ready and makes it the single active profile (atomically). */
export async function completeProfileBuild(id, { profile, postCount, accountCount, fingerprint }) {
  await withTransaction(async (client) => {
    await client.query('UPDATE ai_style_profiles SET is_active = FALSE WHERE is_active');
    await client.query(
      `UPDATE ai_style_profiles
          SET status = 'ready', profile_data = $2::jsonb, source_post_count = $3, source_account_count = $4,
              source_fingerprint = $5, last_generated_at = NOW(), is_active = TRUE, error = NULL
        WHERE id = $1`,
      [id, JSON.stringify(profile), postCount, accountCount, fingerprint],
    );
  });
}

export async function failProfileBuild(id, message) {
  await query(`UPDATE ai_style_profiles SET status = 'failed', error = $2 WHERE id = $1`, [id, message.slice(0, 500)]);
}

/** Builds stuck in 'building' (e.g. the server restarted mid-build) are marked failed. */
export async function failStaleBuilds() {
  await query(
    `UPDATE ai_style_profiles SET status = 'failed', error = 'Interrupted (server restarted)'
      WHERE status = 'building' AND created_at < NOW() - INTERVAL '15 minutes'`,
  );
}

// ── Generations ──
const toGeneration = (r) =>
  r && {
    id: r.id,
    profileId: r.profile_id,
    profileVersion: r.profile_version ?? null,
    parentId: r.parent_id,
    input: r.input,
    output: r.output,
    warnings: r.warnings,
    feedback: r.feedback,
    finalPostId: r.final_post_id,
    editRatio: r.edit_ratio,
    createdAt: r.created_at,
  };

export async function createGeneration({ userId, profileId, parentId, input, output, warnings }) {
  const { rows } = await query(
    `INSERT INTO ai_generations (user_id, profile_id, parent_id, input, output, warnings)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb) RETURNING *`,
    [userId, profileId, parentId, JSON.stringify(input), JSON.stringify(output), JSON.stringify(warnings)],
  );
  return toGeneration(rows[0]);
}

export async function findGeneration(id) {
  const { rows } = await query('SELECT * FROM ai_generations WHERE id = $1', [id]);
  return toGeneration(rows[0]);
}

export async function setFeedback(id, feedback) {
  const { rows } = await query('UPDATE ai_generations SET feedback = $2 WHERE id = $1 RETURNING *', [id, feedback]);
  return toGeneration(rows[0]);
}

export async function setOutcome(id, { postId, finalContent, editRatio }) {
  const { rows } = await query(
    `UPDATE ai_generations SET final_post_id = $2, final_content = $3::jsonb, edit_ratio = $4 WHERE id = $1 RETURNING *`,
    [id, postId, JSON.stringify(finalContent), editRatio],
  );
  return toGeneration(rows[0]);
}

export async function listGenerations({ page = 1, limit = 10 } = {}) {
  const [rows, count] = await Promise.all([
    query(
      `SELECT g.*, s.version AS profile_version FROM ai_generations g
         LEFT JOIN ai_style_profiles s ON s.id = g.profile_id
        ORDER BY g.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, (page - 1) * limit],
    ),
    query('SELECT COUNT(*) AS total FROM ai_generations'),
  ]);
  const total = count.rows[0].total;
  return { generations: rows.rows.map(toGeneration), meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

/**
 * Feedback cases for style improvement: drafts the admin approved, and drafts the admin
 * significantly edited before publishing. Only used when explicitly enabled in settings.
 */
export async function feedbackCases(limit = 12) {
  const { rows } = await query(
    `SELECT g.output, g.final_content, g.feedback, g.edit_ratio
       FROM ai_generations g
       JOIN posts p ON p.id = g.final_post_id AND p.published
      WHERE g.final_content IS NOT NULL AND (g.feedback = 'good' OR g.edit_ratio >= 0.25)
      ORDER BY g.updated_at DESC LIMIT $1`,
    [limit],
  );
  const fmt = (c) => `${c.heading}\n\n${c.description}`;
  return rows.map((r) =>
    r.edit_ratio >= 0.25
      ? { kind: 'edited', generated: fmt(r.output), final: fmt(r.final_content) }
      : { kind: 'approved', final: fmt(r.final_content) },
  );
}

// ── Usage log ──
export async function logUsage({ userId, operation, provider, model, inputTokens, outputTokens, status, error, durationMs }) {
  await query(
    `INSERT INTO ai_generation_logs (user_id, operation, provider, model, input_tokens, output_tokens, status, error, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [userId, operation, provider, model, inputTokens || 0, outputTokens || 0, status, error?.slice(0, 500) || null, durationMs],
  );
}

export async function usageSummary(days = 30) {
  const { rows } = await query(
    `SELECT operation, COUNT(*) AS calls,
            COUNT(*) FILTER (WHERE status = 'error') AS errors,
            COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
            COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens
       FROM ai_generation_logs WHERE created_at > NOW() - make_interval(days => $1)
      GROUP BY operation ORDER BY operation`,
    [days],
  );
  return rows.map((r) => ({
    operation: r.operation,
    calls: r.calls,
    errors: r.errors,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
  }));
}

// ── Settings ──
export async function getSettings() {
  const { rows } = await query('SELECT data FROM ai_settings WHERE id = 1');
  return rows[0]?.data || {};
}

export async function saveSettings(data) {
  const { rows } = await query(
    `INSERT INTO ai_settings (id, data) VALUES (1, $1::jsonb)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data RETURNING data`,
    [JSON.stringify(data)],
  );
  return rows[0].data;
}
