import { env } from '../config/env.js';
import { aiStatus, generatePost, regeneratePost } from '../ai/aiService.js';
import { buildWarnings } from '../ai/guards.js';
import { getOverview, requireActiveProfile, startBuild } from '../ai/styleProfileService.js';
import * as AI from '../models/aiModel.js';
import * as Ref from '../models/referenceModel.js';
import { notFound } from '../utils/httpError.js';
import { ok } from '../utils/respond.js';

export async function status(_req, res) {
  const profile = await AI.activeProfile();
  return ok(res, {
    ...aiStatus(),
    hasProfile: !!profile,
    profileVersion: profile?.version ?? null,
    sourceAccounts: profile?.sourceAccountCount ?? 0,
    sourcePosts: profile?.sourcePostCount ?? 0,
  });
}

export async function getStyle(_req, res) {
  return ok(res, await getOverview());
}

/** POST /style/analyze and /style/rebuild — starts a new profile version (async, 202). */
export async function rebuildStyle(req, res) {
  const row = await startBuild({ userId: req.user.id });
  return ok(res, { buildId: row.id, version: row.version, status: row.status }, { status: 202, message: 'Rebuilding the style profile…' });
}

/** Shared by generate and regenerate. */
async function runGeneration(req, res, { previous, parentId }) {
  const { heading, description, imageUrl, options } = req.valid.body;
  const profileRow = await requireActiveProfile();
  const input = { heading, description, hasImage: !!imageUrl };
  // Retrieval: a few relevant examples — never the whole dataset.
  const examples = await Ref.relevantExamples(`${heading} ${description}`, env.AI_EXAMPLES_PER_GENERATION);

  const args = { input, profile: profileRow.profile, examples, options, previous, userId: req.user.id };
  const { post, model } = previous ? await regeneratePost(args) : await generatePost(args);
  const warnings = buildWarnings(post, input, examples);

  const generation = await AI.createGeneration({
    userId: req.user.id,
    profileId: profileRow.id,
    parentId,
    input: { heading, description, imageUrl: imageUrl || null, options },
    output: post,
    warnings,
  });

  // Never published here: the admin reviews, edits and publishes through the normal post API.
  return ok(
    res,
    {
      generationId: generation.id,
      post,
      warnings,
      style: {
        version: profileRow.version,
        accounts: profileRow.sourceAccountCount,
        posts: profileRow.sourcePostCount,
        examplesUsed: examples.length,
      },
      provider: { ...aiStatus(), model },
    },
    { status: 201 },
  );
}

export async function generate(req, res) {
  return runGeneration(req, res, { previous: null, parentId: null });
}

export async function regenerate(req, res) {
  const prev = await AI.findGeneration(req.valid.body.previousGenerationId);
  if (!prev) throw notFound('Previous generation not found');
  return runGeneration(req, res, { previous: prev.output, parentId: prev.id });
}

export async function feedback(req, res) {
  const gen = await AI.setFeedback(req.valid.params.id, req.valid.body.rating);
  if (!gen) throw notFound('Generation not found');
  return ok(res, gen, { message: 'Thanks — feedback saved' });
}

/** Share of words that differ between two texts (0 = identical, 1 = completely different). */
function editRatio(a, b) {
  const wa = String(a).split(/\s+/).filter(Boolean);
  const wb = String(b).split(/\s+/).filter(Boolean);
  if (!wa.length && !wb.length) return 0;
  const counts = new Map();
  for (const w of wa) counts.set(w, (counts.get(w) || 0) + 1);
  let common = 0;
  for (const w of wb) {
    if (counts.get(w) > 0) {
      common += 1;
      counts.set(w, counts.get(w) - 1);
    }
  }
  return Math.min(1, Math.max(0, 1 - (2 * common) / (wa.length + wb.length)));
}

/** POST /generations/:id/outcome — records what was actually published (for optional learning). */
export async function outcome(req, res) {
  const gen = await AI.findGeneration(req.valid.params.id);
  if (!gen) throw notFound('Generation not found');
  const { postId, heading, description } = req.valid.body;
  const ratio = editRatio(`${gen.output.heading} ${gen.output.description}`, `${heading} ${description}`);
  const updated = await AI.setOutcome(gen.id, {
    postId,
    finalContent: { heading, description },
    editRatio: Number(ratio.toFixed(3)),
  });
  return ok(res, updated);
}

export async function listGenerations(req, res) {
  const { generations, meta } = await AI.listGenerations(req.valid.query);
  return ok(res, generations, { meta });
}

export async function getSettings(_req, res) {
  const data = await AI.getSettings();
  return ok(res, {
    learnFromFeedback: !!data.learnFromFeedback,
    autoRebuild: data.autoRebuild !== false,
    graphic: data.graphic || {},
  });
}

export async function saveSettings(req, res) {
  return ok(res, await AI.saveSettings(req.valid.body), { message: 'AI settings saved' });
}

export async function usage(_req, res) {
  return ok(res, await AI.usageSummary(30));
}
