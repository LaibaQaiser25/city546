import bcrypt from 'bcryptjs';
import * as User from '../models/userModel.js';
import {
  AUTH_COOKIE,
  SESSION_HINT_COOKIE,
  baseCookieOptions,
  cookieOptions,
  signToken,
} from '../services/tokenService.js';
import { unauthorized } from '../utils/httpError.js';
import { ok } from '../utils/respond.js';

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('city546-timing-equaliser', 12);

export async function login(req, res) {
  const { email, password } = req.valid.body;
  const user = await User.findByEmailWithHash(email);
  const valid = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);

  if (!user || !valid || user.role !== 'ADMIN') {
    throw unauthorized('Invalid email or password');
  }

  const { password_hash: _omit, ...safeUser } = user;
  const token = signToken(safeUser);
  const opts = cookieOptions(token);
  res.cookie(AUTH_COOKIE, token, opts);
  res.cookie(SESSION_HINT_COOKIE, '1', { ...opts, httpOnly: false });
  return ok(res, { user: safeUser, token }, { message: 'Login successful' });
}

export async function logout(_req, res) {
  res.clearCookie(AUTH_COOKIE, baseCookieOptions);
  res.clearCookie(SESSION_HINT_COOKIE, { ...baseCookieOptions, httpOnly: false });
  return ok(res, null, { message: 'Logged out' });
}

export async function me(req, res) {
  return ok(res, { user: req.user });
}
