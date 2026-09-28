import { getMetaConnector, MetaError } from '../ai/connectors/metaConnector.js';
import { getTikTokConnector, TikTokError } from '../ai/connectors/tiktokConnector.js';
import * as TikTok from '../ai/connectors/tiktokService.js';
import * as Conn from '../models/connectionModel.js';
import { FeedError, importFeed } from '../ai/feedImporter.js';
import { maybeAutoRebuild } from '../ai/styleProfileService.js';
import * as Ref from '../models/referenceModel.js';
import { badRequest, HttpError, notFound } from '../utils/httpError.js';
import { ok } from '../utils/respond.js';

async function getAccountOr404(id) {
  const account = await Ref.findAccount(id);
  if (!account) throw notFound('Reference account not found');
  return account;
}

export async function list(_req, res) {
  return ok(res, await Ref.listAccounts());
}

export async function create(req, res) {
  try {
    const account = await Ref.createAccount(req.valid.body);
    return ok(res, account, { status: 201, message: 'Reference account added' });
  } catch (err) {
    if (err.code === '23505') throw new HttpError(409, 'That account is already in your reference list', { code: 'CONFLICT' });
    throw err;
  }
}

export async function update(req, res) {
  try {
    const account = await Ref.updateAccount(req.valid.params.id, req.valid.body);
    if (!account) throw notFound('Reference account not found');
    return ok(res, account, { message: 'Reference account updated' });
  } catch (err) {
    if (err.code === '23505') throw new HttpError(409, 'That account is already in your reference list', { code: 'CONFLICT' });
    throw err;
  }
}

export async function remove(req, res) {
  if (!(await Ref.deleteAccount(req.valid.params.id))) throw notFound('Reference account not found');
  return ok(res, { id: req.valid.params.id }, { message: 'Reference account removed' });
}

/** Pulls posts from the account's source: a public feed, or the official Meta Graph API. */
async function fetchSourcePosts(account) {
  if (account.sourceType === 'feed' && account.feedUrl) {
    return { posts: await importFeed(account.feedUrl) };
  }
  if (account.sourceType === 'api' && account.platform === 'tiktok') {
    return { posts: await TikTok.fetchPosts(account.connectionId) };
  }
  if (account.sourceType === 'api') {
    const meta = getMetaConnector();
    const ref = account.externalAccountId || account.profileUrl || account.accountName;
    const result = account.platform === 'facebook' ? await meta.facebookPosts(ref) : await meta.instagramMedia(ref);
    return { posts: result.posts, stoppedEarly: result.stoppedEarly };
  }
  throw badRequest('This account has no feed or API connection. Import its posts manually instead.');
}

export async function sync(req, res) {
  const account = await getAccountOr404(req.valid.params.id);
  let posts;
  let stoppedEarly = false;
  try {
    ({ posts, stoppedEarly = false } = await fetchSourcePosts(account));
  } catch (err) {
    if (err instanceof HttpError) throw err;
    const message = err instanceof FeedError || err instanceof MetaError || err instanceof TikTokError ? err.message : 'Could not fetch posts from this source.';
    await Ref.recordSync(account.id, message);
    throw badRequest(message);
  }
  const added = await Ref.insertPosts(account.id, posts);
  await Ref.recordSync(account.id, null);
  const rebuilding = added > 0 ? await maybeAutoRebuild(req.user.id) : false;
  return ok(
    res,
    { found: posts.length, added, rebuilding, stoppedEarly, account: await Ref.findAccount(account.id) },
    {
      message: `${added ? `Imported ${added} new post${added === 1 ? '' : 's'}` : 'No new posts found'}${stoppedEarly ? ' (paused early to respect Meta rate limits)' : ''}`,
    },
  );
}

/** POST /:id/posts — import an admin-supplied dataset (pasted text, JSON or CSV parsed client-side). */
export async function importPosts(req, res) {
  const account = await getAccountOr404(req.valid.params.id);
  const added = await Ref.insertPosts(account.id, req.valid.body.posts);
  await Ref.recordSync(account.id, null);
  const rebuilding = added > 0 ? await maybeAutoRebuild(req.user.id) : false;
  return ok(
    res,
    { received: req.valid.body.posts.length, added, rebuilding, account: await Ref.findAccount(account.id) },
    { status: 201, message: `Imported ${added} new post${added === 1 ? '' : 's'}` },
  );
}

export async function listPosts(req, res) {
  await getAccountOr404(req.valid.params.id);
  const { posts, meta } = await Ref.listPosts(req.valid.params.id, req.valid.query);
  return ok(res, posts, { meta });
}

export async function removePost(req, res) {
  if (!(await Ref.deletePost(req.valid.params.id, req.valid.params.postId))) throw notFound('Reference post not found');
  return ok(res, { id: req.valid.params.postId }, { message: 'Reference post removed' });
}

/** GET /connectors — which official connectors are configured (no secrets returned). */
export async function connectors(_req, res) {
  const meta = getMetaConnector();
  const tiktok = getTikTokConnector();
  return ok(res, {
    meta: { ...meta.configured, version: meta.version },
    tiktok: { configured: tiktok.configured, scopes: tiktok.scopes, connections: await Conn.list('tiktok') },
  });
}

/** POST /connectors/tiktok/authorize — returns the TikTok consent URL (Admin starts the flow). */
export async function tiktokAuthorize(req, res) {
  try {
    return ok(res, { url: await TikTok.startAuthorization(req.user.id) });
  } catch (err) {
    if (err instanceof TikTokError) throw badRequest(err.message);
    throw err;
  }
}

/** DELETE /connectors/tiktok/:id — revokes access at TikTok and removes the stored tokens. */
export async function tiktokDisconnect(req, res) {
  if (!(await TikTok.disconnect(req.valid.params.id))) throw notFound('TikTok connection not found');
  return ok(res, { id: req.valid.params.id }, { message: 'TikTok account disconnected' });
}

/** POST /connectors/meta/check — verifies the Meta token and Instagram account id. */
export async function checkMeta(_req, res) {
  return ok(res, await getMetaConnector().check());
}
