import { env } from '../config/env.js';
import { AI_ERROR_STATUS } from '../ai/errors.js';
import { HttpError } from '../utils/httpError.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
}

// PostgreSQL error codes worth translating into client errors
const PG_ERRORS = {
  23505: [409, 'CONFLICT', 'A record with these details already exists'],
  23503: [400, 'BAD_REQUEST', 'A referenced record does not exist'],
  23514: [400, 'BAD_REQUEST', 'The data failed a validation rule'],
  '22P02': [400, 'BAD_REQUEST', 'Invalid input syntax'],
};

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
    });
  }

  // Malformed JSON body from express.json()
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Malformed JSON body' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
  }

  // AI failures are expected and non-fatal: return a clear, friendly error (never provider internals).
  if (err.name === 'AIError') {
    if (err.cause) console.warn(`[AI] ${err.code}: ${err.cause.message || err.cause}`);
    return res.status(err.status || AI_ERROR_STATUS[err.code] || 503).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }

  // Upload errors from multer
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: { code: 'PAYLOAD_TOO_LARGE', message: `Image is too large — the maximum is ${env.MAX_UPLOAD_MB} MB` },
      });
    }
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Send the image in a field named "image"' : err.message },
    });
  }

  if (err.code && PG_ERRORS[err.code]) {
    const [status, code, message] = PG_ERRORS[err.code];
    return res.status(status).json({ success: false, error: { code, message } });
  }

  // Unknown error: log details server-side, never leak them to the client.
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side. Please try again.',
      ...(!env.isProduction && { debug: err.message }),
    },
  });
}
