import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const AUTH_COOKIE = 'city546_token';
// Non-secret, JS-readable flag so the SPA only asks /auth/me when a session may exist.
// It grants nothing — authorization always comes from the httpOnly token.
export const SESSION_HINT_COOKIE = 'city546_session';
const ISSUER = 'city546';

export function signToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: ISSUER,
    algorithm: 'HS256',
  });
}

/** Throws if the token is invalid or expired. */
export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET, { issuer: ISSUER, algorithms: ['HS256'] });
}

export const baseCookieOptions = {
  httpOnly: true, // not readable from JS → mitigates token theft via XSS
  secure: env.isProduction,
  sameSite: 'strict', // not sent on cross-site requests → mitigates CSRF
  path: '/',
};

export function cookieOptions(token) {
  const { exp } = jwt.decode(token);
  return { ...baseCookieOptions, expires: new Date(exp * 1000) };
}

/** Reads the token from the httpOnly cookie, or an `Authorization: Bearer` header for API clients. */
export function extractToken(req) {
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return req.cookies?.[AUTH_COOKIE] || null;
}
