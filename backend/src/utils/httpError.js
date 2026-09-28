export class HttpError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message = 'Bad request', details) =>
  new HttpError(400, message, { code: 'BAD_REQUEST', details });
export const unauthorized = (message = 'Authentication required') =>
  new HttpError(401, message, { code: 'UNAUTHORIZED' });
export const forbidden = (message = 'You do not have permission to perform this action') =>
  new HttpError(403, message, { code: 'FORBIDDEN' });
export const notFound = (message = 'Resource not found') =>
  new HttpError(404, message, { code: 'NOT_FOUND' });
