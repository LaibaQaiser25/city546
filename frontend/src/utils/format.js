const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const dateFmt = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const compactFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

/** "5 minutes ago", "yesterday", or "12 Sep 2026" for older dates. */
export function timeAgo(value) {
  if (!value) return '';
  const date = new Date(value);
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.round(seconds / 86400), 'day');
  return dateFmt.format(date);
}

export const formatDate = (value) => (value ? dateFmt.format(new Date(value)) : '—');
export const formatDateTime = (value) => (value ? dateTimeFmt.format(new Date(value)) : '—');
export const compactNumber = (n) => compactFmt.format(n || 0);

/** Estimated reading time in minutes (≈200 words per minute). */
export function readTime(post) {
  const text = [
    post.heading,
    post.description,
    ...(post.blocks || []).map((b) => b.text || b.caption || ''),
  ].join(' ');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export const postUrl = (id) => `${window.location.origin}/news/${id}`;

/** Short uid for client-side block keys. */
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** An uploaded image path (/uploads/…) or an external http(s) URL. */
export const isValidImageRef = (value) =>
  /^\/uploads\/[0-9a-f-]{36}\.(jpg|png|gif|webp)$/.test(value) || isValidHttpUrl(value);

// When the API is hosted on another origin (VITE_API_URL), uploaded images live there too.
const API_ORIGIN = (() => {
  const base = import.meta.env.VITE_API_URL;
  try {
    return base && /^https?:\/\//.test(base) ? new URL(base).origin : '';
  } catch {
    return '';
  }
})();

/** Resolves an image reference to something an <img> can load. */
export const mediaUrl = (url) => (url?.startsWith('/uploads/') ? API_ORIGIN + url : url);

const URDU_SCRIPT = /[؀-ۿ]/;
/** Direction + typography for a piece of user text (Urdu → RTL Nastaliq). */
export const textProps = (text, { leading = 'leading-[2]' } = {}) =>
  URDU_SCRIPT.test(text || '') ? { dir: 'rtl', lang: 'ur', className: `font-urdu ${leading}` } : { dir: 'auto', className: '' };
