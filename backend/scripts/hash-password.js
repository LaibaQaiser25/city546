/**
 * Prints a bcrypt hash for use as ADMIN_PASSWORD_HASH in production.
 *   npm run hash-password -- "your-strong-password"
 */
import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error('Usage: npm run hash-password -- "<password of at least 8 characters>"');
  process.exit(1);
}
console.log(await bcrypt.hash(password, 12));
