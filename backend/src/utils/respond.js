/**
 * Consistent JSON envelope:
 *   success → { success: true, data, meta?, message? }
 *   failure → { success: false, error: { code, message, details? } }  (see errorHandler)
 */
export function ok(res, data, { status = 200, meta, message } = {}) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  if (message) body.message = message;
  return res.status(status).json(body);
}
