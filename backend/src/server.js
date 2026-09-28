import { createApp } from './app.js';
import { pool } from './config/db.js';
import { env } from './config/env.js';

const app = createApp();

try {
  await pool.query('SELECT 1');
  console.log('✅ Connected to PostgreSQL');
} catch (err) {
  console.error(`❌ Could not connect to PostgreSQL: ${err.message}`);
  console.error('   Check DATABASE_URL in .env and that the database is running (npm run db:up).');
}

const server = app.listen(env.PORT, () => {
  console.log(`🚀 city546 API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

const shutdown = (signal) => {
  console.log(`\n${signal} received, shutting down…`);
  server.close(() => pool.end().finally(() => process.exit(0)));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
