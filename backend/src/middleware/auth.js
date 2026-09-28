import * as User from '../models/userModel.js';
import { extractToken, verifyToken } from '../services/tokenService.js';
import { forbidden, unauthorized } from '../utils/httpError.js';

/** Resolves the user from the token and re-checks it against the database. */
async function resolveUser(req) {
  const token = extractToken(req);
  if (!token) return null;
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return null;
  }
  const id = Number(payload.sub);
  if (!Number.isSafeInteger(id)) return null;
  // Always trust the DB, not the token, for the current role.
  return User.findById(id);
}

/** Requires a valid session → 401 otherwise. */
export async function authenticate(req, _res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return next(unauthorized('Please sign in to continue'));
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Requires the authenticated user to be the Admin → 403 otherwise. Use after `authenticate`. */
export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'ADMIN') return next(forbidden('Admin access required'));
  next();
}

/** Attaches req.user when a valid session is present; never fails. */
export async function optionalAuth(req, _res, next) {
  try {
    req.user = await resolveUser(req);
  } catch {
    req.user = null;
  }
  next();
}

export const adminOnly = [authenticate, requireAdmin];
