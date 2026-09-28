/**
 * API integration tests — run against the database in DATABASE_URL.
 *   npm test
 * Requires migrations + seed to have run, and ADMIN_EMAIL / ADMIN_PASSWORD in .env.
 * Test posts are created and cleaned up by the tests themselves.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

process.env.NODE_ENV = 'test';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/config/db.js');

let server;
let base;
let adminCookie;
const createdIds = [];

const validPost = {
  imageUrl: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800',
  heading: 'Integration test headline',
  description: 'This description was written by the automated API test suite.',
  blocks: [
    { type: 'heading', text: 'A sub-heading' },
    { type: 'paragraph', text: 'An extra paragraph.' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=800', caption: 'Caption' },
  ],
};

async function api(method, path, { body, cookie, headers = {} } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(cookie && { Cookie: cookie }),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, headers: res.headers };
}

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;

  const res = await api('POST', '/auth/login', {
    body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
  });
  assert.equal(res.status, 200, 'admin login should succeed — check ADMIN_PASSWORD and run npm run db:seed');
  adminCookie = res.headers.getSetCookie().find((c) => c.startsWith('city546_token=')).split(';')[0];
});

after(async () => {
  for (const id of createdIds) await pool.query('DELETE FROM posts WHERE id = $1', [id]);
  server?.close();
  await pool.end();
});

describe('auth', () => {
  test('rejects wrong password with 401', async () => {
    const res = await api('POST', '/auth/login', { body: { email: process.env.ADMIN_EMAIL, password: 'wrong-password' } });
    assert.equal(res.status, 401);
    assert.equal(res.json.success, false);
  });

  test('sets an httpOnly, SameSite=Strict cookie on login', async () => {
    const res = await api('POST', '/auth/login', {
      body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
    });
    const cookies = res.headers.getSetCookie();
    const token = cookies.find((c) => c.startsWith('city546_token='));
    assert.match(token, /HttpOnly/i);
    assert.match(token, /SameSite=Strict/i);
    // The JS-readable session hint must never carry the token.
    const hint = cookies.find((c) => c.startsWith('city546_session='));
    assert.match(hint, /^city546_session=1;/);
    assert.doesNotMatch(hint, /HttpOnly/i);
  });

  test('GET /auth/me: 401 anonymous, 200 for admin', async () => {
    assert.equal((await api('GET', '/auth/me')).status, 401);
    const res = await api('GET', '/auth/me', { cookie: adminCookie });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.user.role, 'ADMIN');
    assert.equal(res.json.data.user.password_hash, undefined);
  });

  test('rejects forged / tampered tokens', async () => {
    const res = await api('GET', '/admin/stats', { headers: { Authorization: 'Bearer abc.def.ghi' } });
    assert.equal(res.status, 401);
  });

  test('admin password is stored as a bcrypt hash', async () => {
    const { rows } = await pool.query("SELECT password_hash FROM users WHERE role = 'ADMIN'");
    assert.equal(rows.length, 1, 'exactly one admin');
    assert.match(rows[0].password_hash, /^\$2[aby]\$/);
    assert.notEqual(rows[0].password_hash, process.env.ADMIN_PASSWORD);
  });

  test('database refuses a second admin', async () => {
    await assert.rejects(
      pool.query(
        "INSERT INTO users (email, password_hash, role) VALUES ('second@x.com', $1, 'ADMIN')",
        ['$2b$12$' + 'a'.repeat(53)],
      ),
      /users_single_admin_key/,
    );
  });
});

describe('public viewers cannot modify content', () => {
  test('POST /posts without auth → 401', async () => {
    assert.equal((await api('POST', '/posts', { body: validPost })).status, 401);
  });
  test('PUT /posts/:id without auth → 401', async () => {
    assert.equal((await api('PUT', '/posts/1', { body: validPost })).status, 401);
  });
  test('DELETE /posts/:id without auth → 401', async () => {
    assert.equal((await api('DELETE', '/posts/1')).status, 401);
  });
  test('admin APIs without auth → 401', async () => {
    assert.equal((await api('GET', '/admin/stats')).status, 401);
    assert.equal((await api('GET', '/admin/posts')).status, 401);
  });
});

describe('post CRUD (admin)', () => {
  let postId;

  test('rejects empty / invalid posts with 400', async () => {
    const empty = await api('POST', '/posts', { cookie: adminCookie, body: {} });
    assert.equal(empty.status, 400);
    const fields = empty.json.error.details.map((d) => d.field);
    assert.ok(fields.includes('imageUrl') && fields.includes('heading') && fields.includes('description'));

    const badUrl = await api('POST', '/posts', { cookie: adminCookie, body: { ...validPost, imageUrl: 'javascript:alert(1)' } });
    assert.equal(badUrl.status, 400);

    const blank = await api('POST', '/posts', { cookie: adminCookie, body: { ...validPost, heading: '     ' } });
    assert.equal(blank.status, 400);

    const tooLong = await api('POST', '/posts', { cookie: adminCookie, body: { ...validPost, heading: 'x'.repeat(201) } });
    assert.equal(tooLong.status, 400);
  });

  test('creates a post → 201 with block ids', async () => {
    const res = await api('POST', '/posts', { cookie: adminCookie, body: validPost });
    assert.equal(res.status, 201);
    postId = res.json.data.id;
    createdIds.push(postId);
    assert.equal(res.json.data.heading, validPost.heading);
    assert.equal(res.json.data.blocks.length, 3);
    assert.ok(res.json.data.blocks.every((b) => b.id));
    assert.ok(res.json.data.publishedAt);
  });

  test('new post appears in public feed and search', async () => {
    const feed = await api('GET', '/posts?limit=50');
    assert.ok(feed.json.data.some((p) => p.id === postId));
    const search = await api('GET', '/posts?search=integration');
    assert.ok(search.json.data.some((p) => p.id === postId));
    const noMatch = await api('GET', '/posts?search=zzqqxxnomatch');
    assert.equal(noMatch.json.data.length, 0);
  });

  test('updates a post', async () => {
    const res = await api('PUT', `/posts/${postId}`, {
      cookie: adminCookie,
      body: { ...validPost, heading: 'Updated integration headline' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.heading, 'Updated integration headline');
  });

  test('drafts are hidden from the public but visible to admin', async () => {
    await api('PUT', `/posts/${postId}`, { cookie: adminCookie, body: { ...validPost, published: false } });
    assert.equal((await api('GET', `/posts/${postId}`)).status, 404);
    assert.equal((await api('GET', `/posts/${postId}`, { cookie: adminCookie })).status, 200);
    const feed = await api('GET', '/posts?limit=50');
    assert.ok(!feed.json.data.some((p) => p.id === postId));
  });

  test('deletes a post, then 404', async () => {
    const res = await api('DELETE', `/posts/${postId}`, { cookie: adminCookie });
    assert.equal(res.status, 200);
    assert.equal((await api('DELETE', `/posts/${postId}`, { cookie: adminCookie })).status, 404);
  });
});

describe('public reads', () => {
  test('GET /posts returns a paginated envelope', async () => {
    const res = await api('GET', '/posts?page=1&limit=2');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json.data));
    assert.equal(res.json.meta.limit, 2);
  });
  test('GET /posts/:id validates the id', async () => {
    assert.equal((await api('GET', '/posts/not-a-number')).status, 400);
    assert.equal((await api('GET', '/posts/999999999')).status, 404);
  });
  test('GET /categories lists categories', async () => {
    const res = await api('GET', '/categories');
    assert.equal(res.status, 200);
    assert.ok(res.json.data.length > 0);
  });
  test('unknown API routes → 404 JSON', async () => {
    const res = await api('GET', '/does-not-exist');
    assert.equal(res.status, 404);
    assert.equal(res.json.success, false);
  });
});

describe('image uploads', () => {
  // 1×1 transparent PNG
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
  );
  const form = (buffer, name = 'photo.png', type = 'image/png') => {
    const fd = new FormData();
    fd.append('image', new Blob([buffer], { type }), name);
    return fd;
  };
  const upload = (body, cookie) =>
    fetch(`${base}/uploads`, { method: 'POST', body, headers: cookie ? { Cookie: cookie } : {} });

  test('anonymous upload → 401', async () => {
    assert.equal((await upload(form(PNG))).status, 401);
  });

  test('rejects non-images even when disguised as one', async () => {
    const fake = Buffer.from('<svg onload="alert(1)"></svg>'.padEnd(64, ' '));
    const res = await upload(form(fake, 'evil.png'), adminCookie);
    assert.equal(res.status, 400);
  });

  test('admin uploads an image, it is served, and can be used as a post image', async () => {
    const res = await upload(form(PNG), adminCookie);
    assert.equal(res.status, 201);
    const { url } = (await res.json()).data;
    assert.match(url, /^\/uploads\/[0-9a-f-]{36}\.png$/);

    const served = await fetch(base.replace('/api', '') + url);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('content-type'), 'image/png');

    const post = await api('POST', '/posts', { cookie: adminCookie, body: { ...validPost, imageUrl: url, blocks: [{ type: 'image', url }] } });
    assert.equal(post.status, 201);
    createdIds.push(post.json.data.id);
    assert.equal(post.json.data.imageUrl, url);

    // Deleting the post also removes the now-unused file.
    const del = await api('DELETE', `/posts/${post.json.data.id}`, { cookie: adminCookie });
    assert.equal(del.status, 200);
    assert.equal((await fetch(base.replace('/api', '') + url)).status, 404);
  });

  test('arbitrary local paths are not accepted as images', async () => {
    const res = await api('POST', '/posts', { cookie: adminCookie, body: { ...validPost, imageUrl: '/uploads/../../etc/passwd' } });
    assert.equal(res.status, 400);
  });
});
