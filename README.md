# city546 — Daily News Social Platform

A full-stack news feed for **City 546 News HD**, themed on the *Words with Mirza* channel artwork (deep navy, polished gold, broadcast red and blue).

- **Public viewers** browse the social-style news feed, open stories, search, and filter by category. No account needed.
- **One Admin** signs in to create, edit, publish/unpublish and delete posts. Stories are built from a required **Image + Heading + Description**, plus extra blocks added with **(+) Image**, **(+) Heading** and **(+) Description** buttons.

| Layer | Stack |
| --- | --- |
| Frontend | Vite · React 19 · Tailwind CSS v4 · React Router 7 · Axios · lucide-react · react-hot-toast |
| Backend | Node.js · Express 5 · `pg` · zod validation · bcrypt (`bcryptjs`) · JWT in an httpOnly cookie · helmet · rate limiting |
| Database | PostgreSQL 13+ (tested on 16) with SQL migrations and a seed script |

---

## 1. Requirements

- **Node.js 20.19+** (22 or 24 recommended) and npm 10+
- **PostgreSQL 13+**, either:
  - a local install (Windows installer, Homebrew, apt…), **or**
  - **Docker**, using the bundled `docker-compose.yml` (easiest)

---

## 2. Installation

```bash
cd city546
npm install
```

This single command installs the root tooling plus both workspaces (`backend/` and `frontend/`), using npm workspaces.

---

## 3. Environment variables

Copy the example file and edit it:

```bash
cp .env.example .env
```

One `.env` at the repository root is shared by the backend, the migration/seed scripts and the Vite dev proxy. The frontend never receives any secret.

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | no | `development` (default), `production` or `test`. Production enables secure cookies and stricter checks. |
| `PORT` | no | Port for the Express API (default `5000`). The Vite dev proxy reads it from `.env`. |
| `DATABASE_URL` | **yes** | PostgreSQL connection string, e.g. `postgresql://user:pass@localhost:5432/city546`. |
| `DATABASE_SSL` | no | `true` for hosted databases that require TLS (Neon, Supabase, RDS…). |
| `JWT_SECRET` | **yes** | Long random string, at least 32 characters, used to sign auth tokens. The server refuses to start in production with the example value. |
| `JWT_EXPIRES_IN` | no | Session lifetime (default `12h`), e.g. `30m`, `7d`. |
| `CORS_ORIGIN` | no | Comma-separated browser origins allowed to call the API. Only needed when the frontend is hosted on a different origin. |
| `ADMIN_EMAIL` | **yes** (seed) | Email of the single Admin account. |
| `ADMIN_NAME` | no | Display name, shown as the author label (default `city546 Admin`). |
| `ADMIN_PASSWORD` | dev | Plaintext password that the seed script **hashes with bcrypt**. Only the hash is stored. Minimum 8 characters. |
| `ADMIN_PASSWORD_HASH` | prod | Pre-computed bcrypt hash; takes priority over `ADMIN_PASSWORD`. Generate it with `npm run hash-password -- "your-password"`. |
| `UPLOAD_DIR` | no | Folder for uploaded photos (default `backend/uploads`). Use persistent storage in production. |
| `MAX_UPLOAD_MB` | no | Maximum size of one uploaded image (default `8`). |
| `AI_PROVIDER` | no | `anthropic` (Claude), `mock` (offline demo, no real AI), or `none` (AI off). Defaults to `anthropic` when a key is set, otherwise `none`. |
| `AI_API_KEY` | for AI | Anthropic API key. Server-side only. Falls back to `ANTHROPIC_API_KEY`. |
| `AI_MODEL` | no | Claude model id (default `claude-opus-5`). |
| `AI_EFFORT` | no | `low` \| `medium` \| `high` \| `xhigh` \| `max`. Blank uses the provider default. |
| `AI_EMBEDDING_MODEL` | no | Reserved for embedding-capable providers (semantic retrieval). |
| `AI_ANALYSIS_MAX_POSTS` | no | Maximum reference posts sent per style analysis (default `150`). |
| `AI_EXAMPLES_PER_GENERATION` | no | Reference examples retrieved per generated post (default `3`). |
| `AI_TIMEOUT_MS` | no | AI request timeout (default `180000`). |
| `META_ACCESS_TOKEN` | for Meta sync | Long-lived Page token or System User token for the official Graph API. Server-side only. |
| `META_APP_SECRET` | no | Your Meta app secret. Requests are then signed with `appsecret_proof` (recommended). |
| `META_IG_USER_ID` | for Instagram | Your own Instagram Business/Creator account id, used for Business Discovery. |
| `META_GRAPH_VERSION` | no | Graph API version (default `v26.0`). |
| `META_MAX_POSTS_PER_SYNC` | no | Maximum posts fetched per sync (default `100`). |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | for TikTok | Credentials of your TikTok developer app (Login Kit + Display API). Server-side only. |
| `TIKTOK_REDIRECT_URI` | for TikTok | Exact redirect URI registered with TikTok, e.g. `https://your-domain/api/oauth/tiktok/callback`. |
| `TIKTOK_MAX_POSTS_PER_SYNC` | no | Maximum videos fetched per sync (default `100`). |
| `FRONTEND_URL` | no | Origin of the admin UI, only needed if it is hosted separately from the API (used after the OAuth redirect). |
| `TOKEN_ENCRYPTION_KEY` | no | Key for encrypting stored third-party tokens (AES-256-GCM). Defaults to a key derived from `JWT_SECRET`. |
| `ALLOW_PRIVATE_FEED_URLS` | no | `true` allows RSS/Atom feeds on private network addresses. Keep `false` in production. |
| `SEED_SAMPLE_POSTS` | no | `false` to skip the sample stories (default `true`). |
| `VITE_API_URL` | no | Frontend only: full API base URL when the API is hosted separately (default `/api`). |
| `VITE_API_PROXY_TARGET` | no | Dev only: override the Vite proxy target (default `http://127.0.0.1:$PORT`). |

Generate a strong secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 4. Database setup

### Option A: Docker (recommended)

```bash
npm run db:up
```

This starts PostgreSQL 16 on `localhost:5432` with user `city546`, password `city546_dev_password` and database `city546`, which already match `.env.example`. Data persists in a Docker volume. Stop it with `npm run db:down`.

### Option B: an existing PostgreSQL server

Create a database and a user, then point `DATABASE_URL` at it:

```sql
CREATE USER city546 WITH PASSWORD 'choose-a-password';
CREATE DATABASE city546 OWNER city546;
```

```
DATABASE_URL=postgresql://city546:choose-a-password@localhost:5432/city546
```

### Run migrations and seed

```bash
npm run db:migrate   # applies database/migrations/*.sql (tracked in schema_migrations)
npm run db:seed      # creates the Admin + sample posts
# or both at once:
npm run db:setup
```

Both commands can be re-run safely:

- **Migrations** only apply files that haven't run yet. Each runs inside a transaction.
- **Seed** creates the Admin, or updates it if it already exists (e.g. after changing the password in `.env`). It only inserts sample posts when the `posts` table is empty.

To add a schema change later, create `database/migrations/002_your_change.sql` and run `npm run db:migrate`.

---

## 5. Development

```bash
npm run dev
```

This starts both servers together:

- **Frontend:** http://localhost:5173 (Vite, with hot reload)
- **API:** http://localhost:5000/api (Express, restarts on changes)

Vite proxies `/api` to Express, so the browser sees a single origin and the httpOnly auth cookie works without any CORS setup.

Sign in at **http://localhost:5173/admin/login** with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from your `.env`.

### Running frontend and backend independently

```bash
npm run dev:backend    # API only   → http://localhost:5000
npm run dev:frontend   # Vite only  → http://localhost:5173 (needs the API running for data)
```

Or run them from inside each workspace: `cd backend && npm run dev`, `cd frontend && npm run dev`.

---

## 6. Production build

```bash
npm run build          # builds frontend/dist
NODE_ENV=production npm start
```

When `frontend/dist` exists, Express serves the built SPA and the API from **one origin** (http://localhost:5000). For production:

- Set `NODE_ENV=production`, a real `JWT_SECRET`, and `ADMIN_PASSWORD_HASH` instead of `ADMIN_PASSWORD`.
- Serve over **HTTPS**, because the auth cookie is marked `Secure` in production.
- To host the frontend separately (Netlify, Vercel…), build it with `VITE_API_URL=https://api.example.com/api` and add that site's origin to `CORS_ORIGIN`. Cross-site cookies also require the API and the site to share a registrable domain, because the cookie is `SameSite=Strict`.

### Deploying to Railway

`railway.json` in the repo root configures the build, runs migrations and the admin seed before each deploy, starts the server and health-checks `/api/health`.

1. Sign up at [railway.com](https://railway.com) with GitHub. The free trial gives a one-time $5 credit for 30 days (1 GB RAM, 500 MB volume). After that, move to Hobby ($5/mo).
2. **New Project → Deploy from GitHub repo** → pick this repo.
3. In the same project: **+ New → Database → PostgreSQL**.
4. On the app service, **attach a volume** mounted at `/data`. Uploaded images live there and survive redeploys.
5. On the app service, open **Variables** and set:

   | Variable | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference to the Postgres service, private network) |
   | `DATABASE_SSL` | `false` (the private network doesn't need TLS) |
   | `JWT_SECRET` | 64 random characters (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`) |
   | `ADMIN_EMAIL`, `ADMIN_NAME` | your admin account |
   | `ADMIN_PASSWORD_HASH` | output of `npm run hash-password -- "<strong password>"` |
   | `UPLOAD_DIR` | `/data/uploads` |
   | `SEED_SAMPLE_POSTS` | `false` |
   | `AI_PROVIDER` | `none` (or `mock`); `anthropic` costs money per call |
   | `CORS_ORIGIN` | your public URL, e.g. `https://city546-production.up.railway.app` |

6. **Settings → Networking → Generate Domain** (or add your own domain), then set `CORS_ORIGIN` to that URL and redeploy.
7. Set a **usage limit** under account billing so the bill can't grow unexpectedly.

Every push to the connected branch redeploys. Never point `npm test` at this database: the tests write and delete real rows.

---

## 7. Tests and quality checks

```bash
npm test        # API integration tests (node:test) against DATABASE_URL
npm run lint    # ESLint for the frontend
npm run build   # production build
```

The test suite (68 tests) covers:

- Admin login and rejection of wrong passwords
- httpOnly, SameSite=Strict cookies, and rejection of forged tokens
- The password stored as a bcrypt hash, and the database refusing a second Admin
- **Public requests to create, edit, delete or reach admin endpoints are rejected with 401**
- Validation (empty post, invalid or `javascript:` URL, blank or over-long heading)
- Full CRUD, draft visibility, search and pagination
- Uploads: admin-only, disguised non-images rejected, uploaded files served and usable in posts, files removed with their post
- AI: every AI and reference-account endpoint is admin-only, and import deduplicates. The style profile is built asynchronously, versioned, and flagged when out of date.
- AI generation is structured, validated and **never publishes**. Regeneration, feedback and settings work, and an unavailable AI returns a friendly 503.
- AI guards and feeds: the fact and copy checks work, prompt fencing holds, RSS/Atom parsing works, and SSRF attempts are blocked.

- Meta connectors: Page/username parsing, pagination, field mapping, `appsecret_proof` signing, early stop near rate limits, friendly errors, admin-only status, sync with deduplication, and error recording.

- TikTok connector: consent URL, CSRF state (forged or replayed state rejected), scope check with revoke, tokens encrypted at rest (plaintext refused by the DB), sync pagination, automatic refresh, "reconnect needed" state, and disconnect with revoke.

AI tests use the offline demo provider, and the Meta and TikTok tests use fake APIs, so they need no API keys and cost nothing.

The tests create their own posts and delete them afterwards.

---

## 8. Features

### Public site

- **Social-style feed**: publisher badge, time-ago timestamp, category tag, cover photo, headline, summary, preview of extra photos and sections, read time, view counter, copy link and share (native share sheet on mobile; WhatsApp, Facebook and X elsewhere).
- **Home**: *Words with Mirza* hero banner, category chips, featured first story, "Load more" pagination, and a **Trending now** sidebar (most viewed).
- **Latest News**, **Category** pages and **Search**. Search runs on the server with PostgreSQL full-text search plus partial `ILIKE` matching on heading and description.
- **Story page**: large image, drop-cap lead, rendered blocks, author label, date, read time, share bar, related stories, back to feed.
- Light and dark mode (follows the system setting, with a toggle), a responsive mobile menu, skeleton loaders, empty and error states, and toast notifications.

### Admin (`/admin`)

- **Overview**: total, published and draft counts, total views, recent posts and a quick "Create post" action.
- **Manage posts**: table on desktop, cards on mobile. Shows thumbnail, heading, created and updated dates, status and views. Includes search, status filter, pagination, one-click publish/unpublish, edit, and delete with confirmation.
- **Create and edit**, using the same form:
  - Three required fields (**Image**, **Heading**, **Description**), each with a `+` action.
  - **Image from the device:** **Choose photo** opens the file picker on a computer, or the **photo gallery / camera on a phone**. On desktop you can also **drag & drop** or **paste** (Ctrl+V) an image. Upload progress and cancel are shown, and you can still paste an image link and press **+**.
  - Large phone photos are resized in the browser (longest side 2000px) before upload, so posting works on slow mobile data.
  - An "Add to the story" toolbar with **(+) Image / (+) Heading / (+) Description**. Blocks can be reordered (up/down) or removed.
  - Live **feed-card and full-story preview**, validation mirrored from the server, character counters, Published/Draft choice, category, **Reset**, **Cancel**, and a guard against leaving with unsaved changes.

---

## 9. Security model

**Only the single Admin can create, edit or delete posts, and the API enforces this on every request.** Hiding buttons in the UI is not what protects these actions.

- **Passwords** are hashed with bcrypt (12 rounds). A database `CHECK` constraint rejects any `password_hash` that isn't a bcrypt hash, so plaintext can't be stored by accident.
- **Exactly one Admin**: a partial unique index (`users_single_admin_key`) makes a second `ADMIN` row impossible.
- **Sessions**: a JWT (HS256, with issuer check and expiry) in an **httpOnly, SameSite=Strict** cookie (plus `Secure` in production), so JavaScript can't read it and cross-site requests can't send it. A separate `city546_session=1` cookie contains no secret; it only tells the SPA whether it's worth calling `/auth/me`.
- **Authorization middleware** (`authenticate` + `requireAdmin`) re-loads the user from the database on each request, rather than trusting the role claimed in the token.
- **Validation** on the server with zod for every body, query and parameter: lengths, http(s)-only URLs, block schema, control-character stripping. The database adds its own `CHECK` constraints as a final safety net.
- **Other protections**:
  - helmet security headers and a Content-Security-Policy
  - Login rate limiting (10 failed attempts per 15 minutes per IP) and timing-equalised login
  - A CORS allow-list and a 1 MB request body limit
  - Generic 500 responses, so stack traces are never sent to clients
  - Parameterised SQL everywhere

  React escapes all user content; no HTML is rendered from the database.
- **Uploads** are admin-only; authorization runs before the file is even read. The real file type is checked from the file's bytes (JPG, PNG, WebP or GIF only; **no SVG**), regardless of the name or declared type. Files get random names, there's a size limit, and they're served with `nosniff` and a locked-down CSP.
- **Secrets** live only in `.env`, which is git-ignored. The frontend receives no credentials.

---

## 10. REST API

All responses use one envelope:

```jsonc
// success
{ "success": true, "data": …, "meta": { "page": 1, "limit": 10, "total": 9, "totalPages": 1 }, "message": "…" }
// error
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Heading is required", "details": [{ "field": "heading", "message": "…" }] } }
```

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | public | `{ email, password }` → sets the session cookie |
| `POST` | `/api/auth/logout` | public | Clears the session |
| `GET` | `/api/auth/me` | admin | Current admin (401 if not signed in) |
| `GET` | `/api/posts` | public | Published only. `?search=&category=&sort=latest\|popular&page=&limit=` |
| `GET` | `/api/posts/:id` | public | Published only (the Admin can also read drafts) |
| `POST` | `/api/posts/:id/view` | public | Increments the view counter |
| `GET` | `/api/categories` | public | Categories with published-post counts |
| `POST` | `/api/posts` | **admin** | Create → `201` |
| `PUT` | `/api/posts/:id` | **admin** | Update |
| `DELETE` | `/api/posts/:id` | **admin** | Delete |
| `GET` | `/api/admin/posts` | **admin** | All posts, including drafts. `?search=&status=all\|published\|draft&page=&limit=` |
| `GET` | `/api/admin/stats` | **admin** | Totals and recent posts |
| `POST` | `/api/uploads` | **admin** | `multipart/form-data`, field `image` → `201 { url: "/uploads/<uuid>.jpg" }` |
| `GET` | `/uploads/<file>` | public | Serves uploaded images |
| `GET` | `/api/ai/status` | **admin** | Provider, demo flag, and whether a style profile exists |
| `GET` | `/api/ai/style` | **admin** | Active style profile, build status, "needs update" flag, versions |
| `POST` | `/api/ai/style/analyze` · `/api/ai/style/rebuild` | **admin** | Build a new profile version in the background → `202` |
| `POST` | `/api/ai/generate-post` | **admin** | `{ heading, description, imageUrl?, options? }` → styled draft (not published) |
| `POST` | `/api/ai/regenerate-post` | **admin** | Same, plus `previousGenerationId` |
| `GET` | `/api/ai/generations` | **admin** | Draft history |
| `POST` | `/api/ai/generations/:id/feedback` · `/outcome` | **admin** | 👍/👎, and what was finally published |
| `GET` · `PUT` | `/api/ai/settings` | **admin** | Learning options and graphic branding |
| `GET` | `/api/ai/usage` | **admin** | Calls and tokens over the last 30 days |
| `GET` · `POST` | `/api/reference-accounts` | **admin** | List / add reference accounts |
| `PUT` · `DELETE` | `/api/reference-accounts/:id` | **admin** | Edit / remove an account (and its posts) |
| `POST` | `/api/reference-accounts/:id/sync` | **admin** | Pull new posts from the account's RSS/Atom feed or the official Meta API |
| `GET` | `/api/reference-accounts/connectors` | **admin** | Which official connectors are configured (no secrets) |
| `POST` | `/api/reference-accounts/connectors/meta/check` | **admin** | Verify the Meta token (and Instagram account id) |
| `POST` | `/api/reference-accounts/connectors/tiktok/authorize` | **admin** | Start "Connect TikTok" → returns the TikTok consent URL |
| `DELETE` | `/api/reference-accounts/connectors/tiktok/:id` | **admin** | Disconnect: revoke at TikTok and delete the stored tokens |
| `GET` | `/api/oauth/tiktok/callback` | one-time state | TikTok redirect target. Authenticated by a single-use, 10-minute `state` issued to the admin |
| `GET` · `POST` | `/api/reference-accounts/:id/posts` | **admin** | List / import reference posts (up to 500 per request) |
| `DELETE` | `/api/reference-accounts/:id/posts/:postId` | **admin** | Remove one reference post |
| `GET` | `/api/health` | public | API and database health check |

Post payload for `POST` / `PUT`:

```json
{
  "imageUrl": "https://…/cover.jpg",
  "heading": "Headline (3–200 chars)",
  "description": "Opening paragraph (10–20000 chars)",
  "categoryId": 2,
  "published": true,
  "blocks": [
    { "type": "heading",   "text": "Sub-heading" },
    { "type": "paragraph", "text": "More story text" },
    { "type": "image",     "url": "https://…/photo.jpg", "caption": "Optional caption" }
  ]
}
```

Status codes: `200`, `201`, `400` (validation), `401` (not signed in), `403` (not admin), `404`, `409`, `413`, `429` (rate limited), `500`.

---

## 11. AI writing style (teach it once)

city546 can learn the writing and presentation style of public news accounts you choose. It then applies that style automatically to every new post — **the admin never writes an AI prompt**.

```
Public reference accounts → reference posts → style analysis → persistent, versioned style profile
                                                                        ↓
Admin's raw facts (heading + details + photos) + style profile + 3 relevant examples → Claude
                                                                        ↓
                    Structured draft + news-graphic text → admin reviews / edits → admin publishes
```

### One-time setup

1. **Set a provider** in `.env`:
   - Real AI: `AI_PROVIDER=anthropic` plus `AI_API_KEY=...`.
   - Try it for free: `AI_PROVIDER=mock`. This is an offline demo that shows the whole workflow but doesn't write real styled content, and it's clearly labelled "Demo mode" in the UI.

   Run `npm run db:migrate` (migration `003`).
2. **Admin → AI Style → Add public account.** Choose the platform, the account (e.g. `@example_news`), and optionally a profile URL.
3. **Get its posts in**, using either:
   - **Public RSS/Atom feed:** a news site's RSS, or a YouTube channel feed (`https://www.youtube.com/feeds/videos.xml?channel_id=…`). Use **Refresh posts** to pull new ones.
   - **Your own dataset:** paste posts (separated by `---`), or upload JSON or CSV. Facebook and Instagram data exports in `{ "data": [{ "message": … }] }` form work.
4. The **style profile** is rebuilt automatically after new posts arrive (or click **Rebuild style profile**). The page shows what was learned in plain language:
   - tone and headline style
   - paragraphing and openings/closings
   - how facts, names and places are presented
   - hashtags and emoji
   - news-graphic wording
5. Under **Graphic branding**, set the reporter name and photo, a partner logo or label, and the default tagline.

### Every post

1. Open **Create post**. Add a photo, and type the basic facts into **Heading** and **Description**.
2. Click **Generate Styled Post**. You get a preview with:
   - the styled heading, description, caption and hashtags
   - a **1080×1350 news graphic**, styled like the channel's "اہم خبر" cards: tagline, context line, highlight, sub-line, fact bullets, subject photos, reporter photo and name, and brand badges
3. Everything in the preview is editable. You can also:
   - **Regenerate** (same style, new wording)
   - rate it 👍/👎
   - **Download PNG** for social media
   - **Use as cover**, which uploads the graphic and keeps your original photo in the story
4. **Apply to post** fills the form. Nothing is public until you click **Publish**.

Optional controls (length, tone, language) are available but never required.

### Facebook & Instagram connectors (official Meta Graph API)

Reference accounts on Facebook or Instagram can sync automatically through Meta's official Graph API (`graph.facebook.com`, `v26.0`). It never logs in as a user and never scrapes. The connector is in `backend/src/ai/connectors/metaConnector.js`.

| Platform | Endpoint | What you need |
| --- | --- | --- |
| Facebook Page | `GET /{page}/posts?fields=id,message,created_time,full_picture,permalink_url` | **Pages you manage:** a Page access token with `pages_read_engagement` (+ `pages_read_user_content`). **Other public Pages:** Meta's **Page Public Content Access** feature (requires App Review), ideally with a System User token. |
| Instagram | `GET /{your-ig-id}?fields=business_discovery.username(NAME){media{caption,media_type,media_url,thumbnail_url,permalink,timestamp}}` | Your own Instagram **Business/Creator** account linked to a Facebook Page (`META_IG_USER_ID`), and a token with `instagram_basic` + `pages_read_engagement`. It can read any **public Business/Creator** account; personal accounts are not available. |

**Setup**

1. Create an app at developers.facebook.com and add the permissions above. Request **Page Public Content Access** if you need Pages you don't manage.
2. Generate a **long-lived** Page token, or a Business Manager **System User** token (these don't expire).
3. Find your Instagram Business account id with `GET /me/accounts?fields=instagram_business_account` in the Graph API Explorer.
4. Set `META_ACCESS_TOKEN`, `META_IG_USER_ID` and (recommended) `META_APP_SECRET` in `.env`, then restart the API.
5. Admin → AI Style → **Connections → Test connection**.
6. Add an account with the source **Official Meta API**. Give the Page ID, username or URL (Facebook) or the username (Instagram), then use **Refresh posts**.

**How it behaves**

- Only posts with text or captions are stored (photo-only posts give no style signal). Up to `META_MAX_POSTS_PER_SYNC` posts are fetched per sync.
- Posts are deduplicated by post id and content.
- Paging stops early when Meta's rate-limit headers (`x-app-usage`, `x-business-use-case-usage`) exceed 85%.
- Errors are shown on the account card in plain language: expired token, missing permission, account not found, rate limited.
- The token is sent only to `graph.facebook.com` from the server and is never returned by the API or logged.

### TikTok connector (official Login Kit + Display API)

TikTok's public API for businesses (the **Display API**) returns the public videos of accounts that **authorise your app**, for example City 546's own TikTok. Reading arbitrary other accounts requires TikTok's **Research API**, which is limited to approved academic and non-profit research and **prohibits commercial use**, so city546 doesn't use it. For other people's TikTok accounts, upload an export (JSON/CSV) instead.

**Setup**

1. Create an app at developers.tiktok.com. Add **Login Kit** and the **Display API**, and request the scopes `user.info.basic` and `video.list`.
2. Register the redirect URI `https://YOUR-DOMAIN/api/oauth/tiktok/callback`. TikTok needs a public HTTPS URL; for local testing, use a tunnel such as ngrok pointing at the dev server.
3. Set `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` and `TIKTOK_REDIRECT_URI` in `.env`, then restart the API.
4. Admin → AI Style → **Connections → Connect TikTok account**. Approve on TikTok, and you're brought back with the account connected.
5. **Add public account** → TikTok → **Connected TikTok account** → **Refresh posts**.

**How it works**

- **Security:**
  - The OAuth `state` is random, single-use and valid for 10 minutes. It stands in for the admin session on the redirect, because the auth cookie is `SameSite=Strict` and isn't sent.
  - The callback only ever redirects to `/admin/ai-style`.
  - Connections that didn't grant `video.list` are rejected and revoked.
- **Token storage:** access tokens (24 h) and refresh tokens (365 d) are stored **encrypted** (AES-256-GCM) in `platform_connections`. The database rejects anything that isn't encrypted. Tokens are never returned by the API or logged.
- **Refresh:** tokens are refreshed automatically before they expire. If a refresh fails, the connection shows **Reconnect needed**.
- **Disconnect:** revokes access at TikTok and deletes the tokens. Reference posts already imported are kept.
- **Sync:** stores video descriptions (or titles) with the cover image, date and link. It skips videos with no text and deduplicates re-syncs.

### Why the graphic is rendered, not "drawn" by AI

Image-generation models can't reliably write Urdu Nastaliq, and they invent faces. Instead, the AI writes only the graphic's text, strictly from your facts. The app renders the design with your own photos and embedded fonts (Noto Nastaliq Urdu, Inter, Playfair), so text is always crisp, correct and on-brand.

### Safeguards

- **Facts:** the system rules forbid inventing names, numbers, dates, quotes or statistics. After generation, any number not present in your notes is flagged. Details the story would need but that you didn't give are listed as "left out" instead of being made up.
- **Originality:** reference posts are style examples only. The rules forbid copying, and generated text is checked for long word sequences shared with the examples.
- **Prompt injection:** reference posts, the stored profile and admin input are fenced as data. Angle brackets are neutralised, and the rules tell the model to ignore instructions found inside them.
- **Structured output:** Claude returns JSON matching a schema (`output_config.format`). The server re-validates it with zod, strips control characters and caps sizes. Malformed output is never used.
- **Human approval:** AI output is never published automatically.
- **Security:**
  - Keys stay on the server, and all AI routes are admin-only.
  - Generation (40 per 10 minutes) and rebuilds (12 per hour) are rate-limited.
  - Feed fetching blocks private and internal addresses (SSRF), re-checks redirects, and has size and time limits.
- **Resilience:** if AI is unavailable, the form says so, and you can continue creating the post manually.
- **Cost:**
  - Analysis runs only when reference data changes or on an explicit rebuild, and only on a sample of at most 150 posts.
  - Each generation sends the stored profile plus three retrieved examples, never the whole dataset.
  - The stable system prompt and profile are prompt-cached.
  - Every call is logged to `ai_generation_logs`, shown under **AI usage**.
- **Content access:** city546 only reads public feeds and datasets you supply. It never logs in to platforms, scrapes pages, or bypasses CAPTCHAs, rate limits or terms of service.

### Learning from feedback (opt-in)

With **Learn from my edits and approvals** turned on, rebuilds also consider published posts whose AI draft you rated 👍 or noticeably edited. The edit ratio is recorded when you publish. AI drafts on their own are never treated as style examples.

### Retrieval and providers

- **Retrieval:** relevant examples are chosen with PostgreSQL full-text search over the reference posts, topped up with recent ones.
- **Providers:** `backend/src/ai/aiService.js` is the provider-agnostic entry point (`analyzeStyle`, `generatePost`, `regeneratePost`, `generateEmbeddings`). Providers live in `backend/src/ai/providers/`.
  - Claude has no embeddings endpoint, so `generateEmbeddings` returns `null` there.
  - To add semantic retrieval, add a provider that implements `embed()`, plus a pgvector column on `reference_posts`.
- **Model:** the Claude provider uses `claude-opus-5` with adaptive thinking and server-side refusal fallbacks (`fallbacks: "default"`). Set `AI_MODEL` to use a different Claude model.

## 12. Database schema

Defined in `database/migrations/001_initial_schema.sql`:

- **`users`**: `id`, `email` (case-insensitively unique), `name`, `password_hash` (bcrypt-only check), `role` (`ADMIN` enum), `created_at`, `updated_at`. The partial unique index allows only one Admin.
- **`categories`**: `id`, `name`, `slug`, `sort_order`, seeded with 9 categories.
- **`posts`**:
  - `id`, `image_url`, `heading`, `description`
  - `blocks` (JSONB array)
  - `category_id` → categories, `author_id` → users
  - `published`, `views`, `published_at`, `created_at`, `updated_at`
  - a generated `search_vector` (tsvector) with a GIN index

  Constraints cover non-blank text, length limits, http(s) image URLs, `blocks` being an array, and published posts always having a date. There are indexes for the feed, search, category and author lookups.
- **AI tables** (migration `003`, additive only):
  - `reference_accounts`, and `reference_posts` (deduplicated by content hash, full-text indexed)
  - `ai_style_profiles` (versioned JSONB, one active, source fingerprint for "needs update")
  - `ai_generations` (drafts, feedback, published outcome)
  - `ai_generation_logs` (usage)
  - `ai_settings`
- **Connections** (migration `005`): `platform_connections` (OAuth accounts, tokens encrypted and enforced by CHECK), `oauth_states` (one-time CSRF state), and `reference_accounts.connection_id`.
- `updated_at` is kept current by a trigger. It only fires on content changes, so view counts don't change it.

**Images:** posts store an image reference, never binary data. It is either an external `http(s)` URL or the path of a photo uploaded by the admin (`/uploads/<uuid>.jpg`). Migration `002` allows both.

- Uploads are saved to `UPLOAD_DIR` under random names and served at `/uploads/…` (in development, Vite proxies them).
- When a post is deleted, or one of its photos is replaced, files that no other post uses are removed automatically.
- On hosts with a temporary filesystem, mount `UPLOAD_DIR` on a persistent volume. To move to S3 or Cloudinary later, change only `backend/src/services/uploadService.js` (`saveImage`) and the `/uploads` static route.

---

## 13. Project structure

```
city546/
├── backend/
│   ├── scripts/            migrate.js · seed.js · hash-password.js
│   ├── src/
│   │   ├── ai/             aiService · providers/ · prompts · schemas · guards · styleProfileService · feedImporter
│   │   ├── config/         env.js (env loading/validation) · db.js (pg pool)
│   │   ├── controllers/    auth · posts · categories
│   │   ├── middleware/     auth (authenticate/requireAdmin) · validate · errorHandler
│   │   ├── models/         SQL for users · posts · categories
│   │   ├── routes/         /auth · /posts · /admin · /categories
│   │   ├── services/       tokenService (JWT + cookies)
│   │   ├── validators/     zod schemas
│   │   ├── utils/          HttpError · response helpers
│   │   ├── app.js          Express app (security, routes, static SPA)
│   │   └── server.js       entry point
│   └── tests/              API integration tests
├── database/
│   ├── migrations/         001_initial_schema.sql
│   └── seed/               sample-posts.json (fictional sample stories)
├── frontend/
│   ├── public/             favicon.svg · theme-init.js
│   └── src/
│       ├── components/     admin/ · ai/ · brand/ · layout/ · news/ · ui/ · ProtectedRoute
│       ├── config/         site.js (brand, phone, socials, limits)
│       ├── context/        AuthContext · ThemeContext
│       ├── hooks/          useAsync · usePostFeed · useCategories · utils
│       ├── layouts/        PublicLayout · AdminLayout
│       ├── pages/          Home · Feed (latest/category/search) · PostDetail · Login · admin/*
│       ├── services/       api (axios) · postService
│       └── utils/          formatting helpers
├── docker-compose.yml      optional local PostgreSQL
├── .env.example
└── package.json            workspace root scripts
```

**Branding:** change the phone number, social links and show details in `frontend/src/config/site.js`, and colours and fonts in `frontend/src/index.css` (`@theme`).

---

## 14. Root scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Frontend and backend together |
| `npm run dev:frontend` / `npm run dev:backend` | Each one alone |
| `npm run build` | Production build of the frontend |
| `npm start` | Start the API, which also serves `frontend/dist` if it has been built |
| `npm run db:up` / `db:down` | Start or stop the Docker PostgreSQL |
| `npm run db:migrate` / `db:seed` / `db:setup` | Schema, seed, or both |
| `npm run hash-password -- "pw"` | Print a bcrypt hash for `ADMIN_PASSWORD_HASH` |
| `npm test` | API integration tests |
| `npm run lint` | Frontend lint |

---

## 15. Troubleshooting

| Problem | Fix |
| --- | --- |
| `Could not connect to PostgreSQL` | Check that the database is running (`npm run db:up` or your local service) and that `DATABASE_URL` is correct. |
| `Missing required environment variable` | Create `.env` from `.env.example`. |
| Port 5432 already in use (Docker) | A local PostgreSQL is already on that port. Either use it (Option B), or start Docker on another port with `DB_PORT=5433 npm run db:up` and update `DATABASE_URL`. |
| Login says "Too many login attempts" | Wait 15 minutes, or restart the API in development. |
| Changed `ADMIN_PASSWORD` but login still fails | Re-run `npm run db:seed`; it updates the Admin's hash. |
| Meta sync: "token is invalid or has expired" | Generate a new long-lived or System User token and update `META_ACCESS_TOKEN`. |
| Meta sync: "lacks permission" | Pages you don't manage need **Page Public Content Access**. Instagram needs `instagram_basic` + `pages_read_engagement`. |
| Instagram: "isn't a public Business/Creator account" | Business Discovery can't read personal accounts. Use an export upload for those. |
| TikTok: "redirect_uri mismatch" / error after approving | `TIKTOK_REDIRECT_URI` must exactly match the URI registered in the TikTok portal (scheme, host, path). |
| TikTok: "Reconnect needed" | The refresh token expired or access was revoked. Click **Reconnect** in Connections. |
| "AI styling is currently unavailable" | Set `AI_PROVIDER` and `AI_API_KEY` in `.env`, then restart the API. `AI_PROVIDER=mock` gives an offline demo. |
| "No house style learned yet" | Admin → AI Style: add a reference account and import or refresh its posts. |
| Graphic export fails | If a photo was added as a link, upload it instead (some hosts block cross-origin access to images). |
| Feed is empty | Run `npm run db:seed`, or create a post from the Admin dashboard. |
