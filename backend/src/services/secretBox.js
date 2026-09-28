/**
 * Authenticated encryption for third-party tokens at rest (AES-256-GCM).
 * Envelope: "v1:<iv b64>:<auth tag b64>:<ciphertext b64>".
 * Key: TOKEN_ENCRYPTION_KEY if set, otherwise derived from JWT_SECRET with HKDF.
 * Rotating the key makes stored tokens undecryptable → accounts must reconnect.
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

const key = Buffer.from(
  hkdfSync('sha256', env.TOKEN_ENCRYPTION_KEY || env.JWT_SECRET, 'city546', 'third-party-token-encryption', 32),
);

export function seal(plaintext) {
  if (plaintext == null) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${data.toString('base64')}`;
}

export function open(envelope) {
  if (!envelope) return null;
  const [version, iv, tag, data] = envelope.split(':');
  if (version !== 'v1' || !iv || !tag || data == null) throw new Error('Unrecognised token envelope');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
