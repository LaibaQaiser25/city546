import { query } from '../config/db.js';

const PUBLIC_COLUMNS = 'id, email, name, role, created_at, updated_at';

export async function findByEmailWithHash(email) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE LOWER(email) = LOWER($1)`,
    [email],
  );
  return rows[0] || null;
}

export async function findById(id) {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function findAdmin(client = { query }) {
  const { rows } = await client.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE role = 'ADMIN'`);
  return rows[0] || null;
}

/**
 * Creates the single admin, or updates the existing one.
 * The DB's partial unique index guarantees only one ADMIN row can exist.
 */
export async function upsertAdmin({ email, name, passwordHash }, client = { query }) {
  const existing = await findAdmin(client);
  if (existing) {
    const { rows } = await client.query(
      `UPDATE users SET email = $1, name = $2, password_hash = $3 WHERE id = $4 RETURNING ${PUBLIC_COLUMNS}`,
      [email, name, passwordHash, existing.id],
    );
    return { user: rows[0], created: false };
  }
  const { rows } = await client.query(
    `INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, 'ADMIN') RETURNING ${PUBLIC_COLUMNS}`,
    [email, name, passwordHash],
  );
  return { user: rows[0], created: true };
}
