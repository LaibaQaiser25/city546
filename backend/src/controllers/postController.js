import { randomUUID } from 'node:crypto';
import { query } from '../config/db.js';
import * as Category from '../models/categoryModel.js';
import * as Post from '../models/postModel.js';
import { removeUnreferencedUploads, uploadedPathsOf } from '../services/uploadService.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { ok } from '../utils/respond.js';

/** Gives every block a stable id and verifies the category exists. */
async function preparePostInput(body) {
  if (body.categoryId != null && !(await Category.findById(body.categoryId))) {
    throw badRequest('Selected category does not exist', [{ field: 'categoryId', message: 'Category not found' }]);
  }
  return {
    ...body,
    blocks: body.blocks.map((block) => ({ ...block, id: block.id || randomUUID() })),
  };
}

// ── Public ───────────────────────────────────────────────────

/** GET /api/posts?search=&category=&page=&limit=  — published posts only */
export async function listPublished(req, res) {
  const { search, category, sort, page, limit } = req.valid.query;
  const { posts, meta } = await Post.list({ search, category, sort, page, limit, publishedOnly: true });
  return ok(res, posts, { meta });
}

/** GET /api/posts/:id — published only (the admin may also see drafts) */
export async function getOne(req, res) {
  const isAdmin = req.user?.role === 'ADMIN';
  const post = await Post.findById(req.valid.params.id, { publishedOnly: !isAdmin });
  if (!post) throw notFound('This story could not be found');
  return ok(res, post);
}

/** POST /api/posts/:id/view — increments the public view counter */
export async function registerView(req, res) {
  const views = await Post.incrementViews(req.valid.params.id);
  if (views === null) throw notFound('This story could not be found');
  return ok(res, { views });
}

// ── Admin ────────────────────────────────────────────────────

/** GET /api/admin/posts — every post, including drafts */
export async function listAll(req, res) {
  const { search, category, status, page, limit } = req.valid.query;
  const { posts, meta } = await Post.list({ search, category, status, page, limit, publishedOnly: false });
  return ok(res, posts, { meta });
}

export async function create(req, res) {
  const input = await preparePostInput(req.valid.body);
  const post = await Post.create(input, req.user.id);
  return ok(res, post, {
    status: 201,
    message: post.published ? 'Post published successfully.' : 'Draft saved successfully.',
  });
}

export async function update(req, res) {
  const input = await preparePostInput(req.valid.body);
  const before = await Post.findById(req.valid.params.id, { publishedOnly: false });
  const post = await Post.update(req.valid.params.id, input);
  if (!post) throw notFound('This story could not be found');
  await removeUnreferencedUploads(uploadedPathsOf(before), query); // images that were replaced
  return ok(res, post, { message: 'Post updated successfully.' });
}

export async function remove(req, res) {
  const existing = await Post.findById(req.valid.params.id, { publishedOnly: false });
  const deleted = await Post.remove(req.valid.params.id);
  if (!deleted) throw notFound('This story could not be found');
  await removeUnreferencedUploads(uploadedPathsOf(existing), query);
  return ok(res, { id: req.valid.params.id }, { message: 'Post deleted successfully.' });
}

/** GET /api/admin/stats */
export async function stats(_req, res) {
  const [totals, recent] = await Promise.all([
    Post.stats(),
    Post.list({ publishedOnly: false, page: 1, limit: 5 }),
  ]);
  return ok(res, { ...totals, recent: recent.posts });
}
