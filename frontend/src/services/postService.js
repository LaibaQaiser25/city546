import { api } from './api';

const clean = (params) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));

// ── Public ──
export async function fetchPosts({ search, category, sort, page = 1, limit = 10 } = {}, { signal } = {}) {
  const { data } = await api.get('/posts', { params: clean({ search, category, sort, page, limit }), signal });
  return { posts: data.data, meta: data.meta };
}

export async function fetchPost(id, { signal } = {}) {
  const { data } = await api.get(`/posts/${id}`, { signal });
  return data.data;
}

export async function registerView(id) {
  const { data } = await api.post(`/posts/${id}/view`);
  return data.data.views;
}

export async function fetchCategories({ signal } = {}) {
  const { data } = await api.get('/categories', { signal });
  return data.data;
}

// ── Admin (the API enforces authorization on every call) ──
export async function fetchAdminPosts({ search, status, page = 1, limit = 10 } = {}, { signal } = {}) {
  const { data } = await api.get('/admin/posts', { params: clean({ search, status, page, limit }), signal });
  return { posts: data.data, meta: data.meta };
}

export async function fetchAdminStats({ signal } = {}) {
  const { data } = await api.get('/admin/stats', { signal });
  return data.data;
}

export async function createPost(post) {
  const { data } = await api.post('/posts', post);
  return data;
}

export async function updatePost(id, post) {
  const { data } = await api.put(`/posts/${id}`, post);
  return data;
}

export async function deletePost(id) {
  const { data } = await api.delete(`/posts/${id}`);
  return data;
}

/** Converts an API post into the payload shape accepted by POST/PUT. */
export const toPayload = (post, overrides = {}) => ({
  imageUrl: post.imageUrl,
  heading: post.heading,
  description: post.description,
  blocks: post.blocks,
  categoryId: post.category?.id ?? post.categoryId ?? null,
  published: post.published,
  ...overrides,
});
