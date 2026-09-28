/** AI failures carry a code the API maps to a friendly, non-fatal response. */
export function aiError(code, message, cause) {
  const err = new Error(message);
  err.name = 'AIError';
  err.code = code;
  if (cause) err.cause = cause;
  return err;
}

export const AI_ERROR_STATUS = {
  AI_DISABLED: 503,
  AI_NOT_CONFIGURED: 503,
  AI_UNAVAILABLE: 503,
  AI_RATE_LIMITED: 429,
  AI_REFUSED: 422,
  AI_INVALID_OUTPUT: 502,
  AI_BAD_REQUEST: 502,
  AI_NO_PROFILE: 409,
  AI_BUSY: 409,
};
