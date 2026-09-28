import { badRequest } from '../utils/httpError.js';

/**
 * Validates req[source] against a zod schema and replaces it with the parsed value
 * (stored on req.valid[source], since Express 5 makes req.query read-only).
 */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source] ?? {});
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || source,
      message: issue.message,
    }));
    return next(badRequest(details[0]?.message || 'Validation failed', details));
  }
  req.valid = { ...req.valid, [source]: result.data };
  next();
};
