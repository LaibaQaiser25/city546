import { query } from '../config/db.js';

export async function listWithCounts() {
  const { rows } = await query(`
    SELECT c.id, c.name, c.slug,
           COUNT(p.id) FILTER (WHERE p.published) AS post_count
      FROM categories c
      LEFT JOIN posts p ON p.category_id = c.id
     GROUP BY c.id
     ORDER BY c.sort_order, c.name
  `);
  return rows;
}

export async function findById(id) {
  const { rows } = await query('SELECT id, name, slug FROM categories WHERE id = $1', [id]);
  return rows[0] || null;
}
