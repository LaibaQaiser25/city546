import { api } from './api';

// All AI calls go through our backend (Admin-only). The browser never talks to an AI provider.
const data = (p) => p.then((r) => r.data.data);
const page = (p) => p.then((r) => ({ items: r.data.data, meta: r.data.meta }));

export const aiApi = {
  status: (opts) => data(api.get('/ai/status', opts)),
  style: (opts) => data(api.get('/ai/style', opts)),
  rebuild: () => api.post('/ai/style/rebuild').then((r) => r.data),
  generate: (body) => data(api.post('/ai/generate-post', body, { timeout: 240_000 })),
  regenerate: (body) => data(api.post('/ai/regenerate-post', body, { timeout: 240_000 })),
  feedback: (id, rating) => data(api.post(`/ai/generations/${id}/feedback`, { rating })),
  outcome: (id, body) => data(api.post(`/ai/generations/${id}/outcome`, body)),
  generations: (params, opts) => page(api.get('/ai/generations', { params, ...opts })),
  settings: (opts) => data(api.get('/ai/settings', opts)),
  saveSettings: (body) => api.put('/ai/settings', body).then((r) => r.data),
  usage: (opts) => data(api.get('/ai/usage', opts)),
};

export const referenceApi = {
  list: (opts) => data(api.get('/reference-accounts', opts)),
  create: (body) => api.post('/reference-accounts', body).then((r) => r.data),
  update: (id, body) => api.put(`/reference-accounts/${id}`, body).then((r) => r.data),
  remove: (id) => api.delete(`/reference-accounts/${id}`).then((r) => r.data),
  sync: (id) => api.post(`/reference-accounts/${id}/sync`, null, { timeout: 60_000 }).then((r) => r.data),
  posts: (id, params, opts) => page(api.get(`/reference-accounts/${id}/posts`, { params, ...opts })),
  importPosts: (id, posts) => api.post(`/reference-accounts/${id}/posts`, { posts }).then((r) => r.data),
  removePost: (id, postId) => api.delete(`/reference-accounts/${id}/posts/${postId}`).then((r) => r.data),
  connectors: (opts) => data(api.get('/reference-accounts/connectors', opts)),
  checkMeta: () => data(api.post('/reference-accounts/connectors/meta/check', null, { timeout: 40_000 })),
  tiktokAuthorize: () => data(api.post('/reference-accounts/connectors/tiktok/authorize')),
  tiktokDisconnect: (id) => api.delete(`/reference-accounts/connectors/tiktok/${id}`).then((r) => r.data),
};
