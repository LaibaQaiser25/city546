/**
 * Builds, versions and serves the persistent Style Profile.
 * Analysis runs ONLY when reference data changes (auto-rebuild after an import/sync)
 * or when the admin explicitly rebuilds — never per post.
 */
import { env } from '../config/env.js';
import * as AI from '../models/aiModel.js';
import * as Ref from '../models/referenceModel.js';
import { analyzeStyle, aiStatus } from './aiService.js';
import { aiError } from './errors.js';

let building = null; // single-flight: one analysis at a time per server

export const isBuilding = () => !!building;

/**
 * Starts a new profile version in the background. Resolves immediately with the
 * 'building' row; poll getOverview() for the result.
 */
export async function startBuild({ userId } = {}) {
  const status = aiStatus();
  if (!status.enabled) throw aiError('AI_DISABLED', 'AI styling is not configured on this server.');
  if (building) throw aiError('AI_BUSY', 'The style profile is already being rebuilt.');

  const fp = await Ref.currentFingerprint();
  if (!fp.posts) {
    const err = aiError('AI_NO_PROFILE', 'Add at least one reference post before building a style profile.');
    err.status = 400;
    throw err;
  }

  const row = await AI.startProfileBuild({ provider: status.provider, model: status.model });
  building = run(row.id, userId).finally(() => {
    building = null;
  });
  return row;
}

async function run(profileId, userId) {
  try {
    const settings = await AI.getSettings();
    const fp = await Ref.currentFingerprint();
    const posts = await Ref.sampleForAnalysis(env.AI_ANALYSIS_MAX_POSTS);
    // Admin feedback only influences the style when explicitly enabled.
    const feedback = settings.learnFromFeedback ? await AI.feedbackCases() : [];
    const { profile } = await analyzeStyle({ posts, feedback, userId });
    await AI.completeProfileBuild(profileId, {
      profile,
      postCount: posts.length,
      accountCount: Number(fp.accounts),
      fingerprint: fp.fp,
    });
  } catch (err) {
    console.error('Style profile build failed:', err.message);
    await AI.failProfileBuild(profileId, err.message || 'Analysis failed').catch(() => {});
  }
}

/** Rebuild automatically after new reference posts arrive (if enabled and possible). */
export async function maybeAutoRebuild(userId) {
  try {
    const settings = await AI.getSettings();
    if (settings.autoRebuild === false || !aiStatus().enabled || building) return false;
    await startBuild({ userId });
    return true;
  } catch {
    return false;
  }
}

/** Everything the "AI Style" page needs in one call. */
export async function getOverview() {
  await AI.failStaleBuilds();
  const [active, latest, fp, versions, accounts] = await Promise.all([
    AI.activeProfile(),
    AI.latestProfile(),
    Ref.currentFingerprint(),
    AI.listProfileVersions(8),
    Ref.listAccounts(),
  ]);
  const activeAccounts = accounts.filter((a) => a.active);
  return {
    ai: aiStatus(),
    profile: active,
    build: latest && latest.id !== active?.id ? { id: latest.id, version: latest.version, status: latest.status, error: latest.error, createdAt: latest.createdAt } : null,
    building: isBuilding() || latest?.status === 'building',
    needsUpdate: !!active && active.sourceFingerprint !== fp.fp,
    reference: {
      accounts: activeAccounts.length,
      totalAccounts: accounts.length,
      posts: Number(fp.posts),
    },
    versions,
  };
}

/** The profile used for generation (throws a friendly error if there isn't one yet). */
export async function requireActiveProfile() {
  const profile = await AI.activeProfile();
  if (!profile) {
    throw aiError('AI_NO_PROFILE', 'No style profile yet. Add reference accounts on the AI Style page first.');
  }
  return profile;
}
