/**
 * Seeds the database:
 *   1. Creates (or updates) the single Admin account — password stored as a bcrypt hash only.
 *   2. Inserts sample news posts if the posts table is empty.
 * Safe to run repeatedly.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { pool, withTransaction } from '../src/config/db.js';
import { ROOT_DIR } from '../src/config/env.js';
import { upsertAdmin } from '../src/models/userModel.js';

const BCRYPT_ROUNDS = 12;

async function resolvePasswordHash() {
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim();
  if (hash) {
    if (!/^\$2[aby]\$\d{2}\$.{53}$/.test(hash)) throw new Error('ADMIN_PASSWORD_HASH is not a valid bcrypt hash.');
    return hash;
  }
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error('Set ADMIN_PASSWORD or ADMIN_PASSWORD_HASH in .env');
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
  if (process.env.NODE_ENV === 'production' && /change_this/i.test(password)) {
    throw new Error('ADMIN_PASSWORD still has the example value. Choose a strong password.');
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error('Set ADMIN_EMAIL in .env');
  const name = process.env.ADMIN_NAME?.trim() || 'city546 Admin';
  const passwordHash = await resolvePasswordHash();

  await withTransaction(async (client) => {
    const { user, created } = await upsertAdmin({ email, name, passwordHash }, client);
    console.log(`  ✔ admin ${created ? 'created' : 'updated'}: ${user.email}`);

    if (process.env.SEED_SAMPLE_POSTS === 'false') return;

    const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM posts');
    if (rows[0].n > 0) {
      console.log(`  • posts table already has ${rows[0].n} post(s) — skipping sample posts`);
      return;
    }

    const samples = JSON.parse(
      await fs.readFile(path.join(ROOT_DIR, 'database', 'seed', 'sample-posts.json'), 'utf8'),
    );
    for (const [i, post] of samples.entries()) {
      const blocks = post.blocks.map((b, j) => ({ id: `seed-${i + 1}-${j + 1}`, ...b }));
      await client.query(
        `INSERT INTO posts (image_url, heading, description, blocks, category_id, author_id,
                            published, views, published_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, (SELECT id FROM categories WHERE slug = $5), $6,
                 TRUE, $7, NOW() - make_interval(hours => $8), NOW() - make_interval(hours => $8),
                 NOW() - make_interval(hours => $8))`,
        [post.imageUrl, post.heading, post.description, JSON.stringify(blocks), post.category, user.id, post.views ?? 0, post.hoursAgo ?? i],
      );
    }
    console.log(`  ✔ inserted ${samples.length} sample posts`);
  });

  console.log('✅ Seed complete.');
}

main()
  .catch((err) => {
    console.error(`❌ Seed failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
