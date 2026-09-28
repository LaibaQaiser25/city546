import { query } from '../config/db.js';

const SELECT_POST = `
  SELECT p.id, p.image_url, p.heading, p.description, p.blocks, p.published,
         p.views, p.published_at, p.created_at, p.updated_at,
         p.category_id,
         c.name AS category_name, c.slug AS category_slug,
         u.name AS author_name
    FROM posts p
    LEFT JOIN categories c ON c.id = p.category_id
    JOIN users u ON u.id = p.author_id
`;

function toPost(row) {
  if (!row) return null;
  return {
    id: row.id,
    imageUrl: row.image_url,
    heading: row.heading,
    description: row.description,
    blocks: row.blocks || [],
    published: row.published,
    views: row.views,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    category: row.category_id
      ? { id: row.category_id, name: row.category_name, slug: row.category_slug }
      : null,
    author: { name: row.author_name },
  };
}

/** Escapes LIKE wildcards so user input is matched literally. */
const escapeLike = (s) => s.replace(/[\\%_]/g, (ch) => `\\${ch}`);

/**
 * Lists posts with optional search / category / status filters and pagination.
 * `publishedOnly` must be true for every public request.
 */
export async function list({ search, category, status, sort = 'latest', publishedOnly, page = 1, limit = 10 }) {
  const where = [];
  const params = [];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (publishedOnly) {
    where.push('p.published = TRUE');
  } else if (status === 'published') {
    where.push('p.published = TRUE');
  } else if (status === 'draft') {
    where.push('p.published = FALSE');
  }

  if (category) where.push(`c.slug = ${add(category)}`);

  let rank = null;
  if (search) {
    const ts = add(search);
    const like = add(`%${escapeLike(search)}%`);
    where.push(`(p.search_vector @@ websearch_to_tsquery('simple', ${ts})
                 OR p.heading ILIKE ${like} OR p.description ILIKE ${like})`);
    rank = `ts_rank(p.search_vector, websearch_to_tsquery('simple', ${ts}))`;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql = [
    rank && `${rank} DESC`,
    sort === 'popular' && 'p.views DESC',
    publishedOnly ? 'p.published_at DESC' : 'p.created_at DESC',
    'p.id DESC',
  ]
    .filter(Boolean)
    .join(', ');

  const countParams = [...params];
  const offset = (page - 1) * limit;
  const limitRef = add(limit);
  const offsetRef = add(offset);

  const [rowsResult, countResult] = await Promise.all([
    query(`${SELECT_POST} ${whereSql} ORDER BY ${orderSql} LIMIT ${limitRef} OFFSET ${offsetRef}`, params),
    query(
      `SELECT COUNT(*) AS total FROM posts p LEFT JOIN categories c ON c.id = p.category_id ${whereSql}`,
      countParams,
    ),
  ]);

  const total = countResult.rows[0].total;
  return {
    posts: rowsResult.rows.map(toPost),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function findById(id, { publishedOnly = true } = {}) {
  const { rows } = await query(
    `${SELECT_POST} WHERE p.id = $1 ${publishedOnly ? 'AND p.published = TRUE' : ''}`,
    [id],
  );
  return toPost(rows[0]);
}

export async function create({ imageUrl, heading, description, blocks, categoryId, published }, authorId) {
  const { rows } = await query(
    `INSERT INTO posts (image_url, heading, description, blocks, category_id, published, published_at, author_id)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, CASE WHEN $6 THEN NOW() ELSE NULL END, $7)
     RETURNING id`,
    [imageUrl, heading, description, JSON.stringify(blocks), categoryId, published, authorId],
  );
  return findById(rows[0].id, { publishedOnly: false });
}

export async function update(id, { imageUrl, heading, description, blocks, categoryId, published }) {
  // published_at is set the first time a post is published and kept afterwards.
  const { rows } = await query(
    `UPDATE posts
        SET image_url = $1, heading = $2, description = $3, blocks = $4::jsonb,
            category_id = $5, published = $6,
            published_at = CASE WHEN $6 THEN COALESCE(published_at, NOW()) ELSE published_at END
      WHERE id = $7
      RETURNING id`,
    [imageUrl, heading, description, JSON.stringify(blocks), categoryId, published, id],
  );
  if (!rows[0]) return null;
  return findById(id, { publishedOnly: false });
}

export async function remove(id) {
  const { rowCount } = await query('DELETE FROM posts WHERE id = $1', [id]);
  return rowCount > 0;
}

export async function incrementViews(id) {
  const { rows } = await query(
    'UPDATE posts SET views = views + 1 WHERE id = $1 AND published = TRUE RETURNING views',
    [id],
  );
  return rows[0]?.views ?? null;
}

export async function stats() {
  const { rows } = await query(`
    SELECT COUNT(*)                                  AS total,
           COUNT(*) FILTER (WHERE published)         AS published,
           COUNT(*) FILTER (WHERE NOT published)     AS drafts,
           COALESCE(SUM(views), 0)::bigint           AS views
      FROM posts
  `);
  return rows[0];
}
