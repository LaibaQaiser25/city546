/**
 * Parses an admin-supplied dataset of reference posts into { content, imageUrl, publishedAt, externalPostId }.
 * Supported: pasted text (posts separated by a line containing ---), JSON (array, or an object with a
 * data/posts/items array — e.g. a Facebook/Instagram data export), and CSV with a header row.
 * The server re-validates everything.
 */
const CONTENT_KEYS = ['content', 'text', 'message', 'caption', 'description', 'body', 'post', 'title'];
const IMAGE_KEYS = ['imageUrl', 'image_url', 'image', 'full_picture', 'media_url', 'thumbnail', 'picture'];
const DATE_KEYS = ['publishedAt', 'published_at', 'date', 'created_time', 'timestamp', 'createdAt', 'created_at'];
const ID_KEYS = ['externalPostId', 'id', 'post_id', 'postId', 'url', 'permalink'];

const pick = (obj, keys) => {
  for (const k of keys) {
    const hit = Object.keys(obj).find((key) => key.toLowerCase() === k.toLowerCase());
    if (hit && obj[hit] != null && String(obj[hit]).trim()) return obj[hit];
  }
  return null;
};

const toDate = (v) => {
  if (v == null || v === '') return null;
  const d = typeof v === 'number' ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

function normalize(item) {
  if (typeof item === 'string') return item.trim() ? { content: item.trim() } : null;
  if (!item || typeof item !== 'object') return null;
  const content = pick(item, CONTENT_KEYS);
  if (!content || typeof content !== 'string') return null;
  const image = pick(item, IMAGE_KEYS);
  return {
    content: content.trim().slice(0, 20000),
    imageUrl: typeof image === 'string' && /^https?:\/\//i.test(image) ? image : null,
    publishedAt: toDate(pick(item, DATE_KEYS)),
    externalPostId: pick(item, ID_KEYS) ? String(pick(item, ID_KEYS)).slice(0, 300) : null,
  };
}

export function parseText(text) {
  return String(text)
    .split(/^\s*-{3,}\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((content) => ({ content: content.slice(0, 20000) }));
}

export function parseJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const list = Array.isArray(data) ? data : data?.data || data?.posts || data?.items || data?.entries;
  if (!Array.isArray(list)) throw new Error('Expected a JSON array of posts (or an object with a "data", "posts" or "items" array).');
  return list.map(normalize).filter(Boolean);
}

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, newlines in quotes). */
function csvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim()));
}

export function parseCsv(text) {
  const [header, ...rows] = csvRows(text.replace(/^\uFEFF/, ''));
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  if (!keys.some((k) => CONTENT_KEYS.includes(k.toLowerCase()))) {
    throw new Error(`The CSV needs a column named one of: ${CONTENT_KEYS.join(', ')}.`);
  }
  return rows.map((r) => normalize(Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])))).filter(Boolean);
}

export function parseFile(name, text) {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'json') return parseJson(text);
  if (ext === 'csv') return parseCsv(text);
  return parseText(text);
}
