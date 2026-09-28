/**
 * Imports reference posts from PUBLIC, machine-readable feeds (RSS 2.0 / Atom) — e.g. a
 * news site's RSS feed or a YouTube channel feed
 * (https://www.youtube.com/feeds/videos.xml?channel_id=…).
 *
 * This deliberately does NOT scrape social-media pages: no logins, no CAPTCHA or rate-limit
 * evasion, no bypassing platform restrictions. Platforms without a public feed are imported
 * through the admin's own dataset (paste / JSON / CSV), or via an official API connector.
 *
 * SSRF protection: only http(s); hostnames resolving to private/loopback/link-local ranges are
 * refused (unless ALLOW_PRIVATE_FEED_URLS=true); redirects are re-checked; size and time limits.
 */
import dns from 'node:dns/promises';
import net from 'node:net';
import { XMLParser } from 'fast-xml-parser';
import { env } from '../config/env.js';

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;
export const MAX_FEED_ITEMS = 100;

export class FeedError extends Error {}

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
}

async function assertPublicUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new FeedError('The feed URL is not valid.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new FeedError('Only http(s) feed URLs are allowed.');
  if (env.ALLOW_PRIVATE_FEED_URLS) return url;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
  if (!addresses.length) throw new FeedError(`Could not resolve ${url.hostname}.`);
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new FeedError('Feeds on private or internal network addresses are not allowed.');
  }
  return url;
}

async function fetchFeed(rawUrl) {
  let url = await assertPublicUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': 'city546-style-importer/1.0 (+public feed reader)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
      },
    }).catch((err) => {
      throw new FeedError(err.name === 'TimeoutError' ? 'The feed took too long to respond.' : 'Could not reach the feed.');
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = await assertPublicUrl(new URL(res.headers.get('location'), url).href);
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      throw new FeedError('This feed requires permission to access, so it can’t be imported.');
    }
    if (!res.ok) throw new FeedError(`The feed returned HTTP ${res.status}.`);

    // Read with a hard size cap.
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new FeedError('The feed is too large (over 3 MB).');
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  throw new FeedError('Too many redirects.');
}

// ── Parsing ──
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function htmlToText(html) {
  return String(html ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const textOf = (v) => (v == null ? '' : typeof v === 'object' ? (v['#text'] ?? '') : String(v));
const attr = (v, name) => asArray(v).map((x) => x?.[`@_${name}`]).find(Boolean);

function toPost({ id, title, body, published, image, link }) {
  const t = htmlToText(title);
  const b = htmlToText(body);
  const content = (b && t && !b.startsWith(t) ? `${t}\n\n${b}` : b || t).slice(0, 20000);
  if (!content) return null;
  const date = published ? new Date(published) : null;
  return {
    externalPostId: String(id || link || '').slice(0, 300) || null,
    content,
    imageUrl: image && /^https?:\/\//i.test(image) ? image : null,
    publishedAt: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
    metadata: link ? { link: String(link).slice(0, 500) } : {},
  };
}

export function parseFeed(xml) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', processEntities: true });
  let doc;
  try {
    doc = parser.parse(xml);
  } catch {
    throw new FeedError('The feed is not valid XML.');
  }

  if (doc?.rss?.channel) {
    return asArray(doc.rss.channel.item).map((it) =>
      toPost({
        id: textOf(it.guid),
        title: textOf(it.title),
        body: textOf(it['content:encoded']) || textOf(it.description),
        published: textOf(it.pubDate),
        link: textOf(it.link),
        image: attr(it.enclosure, 'url') || attr(it['media:content'], 'url') || attr(it['media:thumbnail'], 'url'),
      }),
    );
  }
  if (doc?.feed) {
    return asArray(doc.feed.entry).map((it) => {
      const group = it['media:group'] || {};
      return toPost({
        id: textOf(it.id),
        title: textOf(it.title),
        body: textOf(group['media:description']) || textOf(it.content) || textOf(it.summary),
        published: textOf(it.published) || textOf(it.updated),
        link: attr(it.link, 'href'),
        image: attr(group['media:thumbnail'], 'url') || attr(it['media:thumbnail'], 'url'),
      });
    });
  }
  throw new FeedError('This URL is not an RSS or Atom feed.');
}

export async function importFeed(url) {
  const xml = await fetchFeed(url);
  return parseFeed(xml).filter(Boolean).slice(0, MAX_FEED_ITEMS);
}
