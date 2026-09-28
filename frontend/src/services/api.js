import axios from 'axios';

/**
 * Shared HTTP client.
 * - Dev: Vite proxies `/api` to Express, so requests are same-origin.
 * - Separate hosting: set VITE_API_URL (e.g. https://api.example.com/api).
 * The auth token lives in an httpOnly cookie, so it's sent via `withCredentials`
 * and never touched by JavaScript.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  timeout: 15000,
});

/** Normalises every failure into an Error with `status`, `code` and `details`. */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isCancel(error)) return Promise.reject(error);
    const payload = error.response?.data?.error;
    const normalized = new Error(
      payload?.message ||
        (error.code === 'ECONNABORTED'
          ? 'The request timed out. Please try again.'
          : error.response
            ? 'Something went wrong. Please try again.'
            : 'Unable to reach the server. Check your connection and try again.'),
    );
    normalized.status = error.response?.status ?? 0;
    normalized.code = payload?.code;
    normalized.details = payload?.details || [];
    normalized.url = error.config?.url;
    return Promise.reject(normalized);
  },
);

export const isAbort = (err) => axios.isCancel(err) || err?.name === 'CanceledError';
