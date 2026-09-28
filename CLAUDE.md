# CLAUDE.md — city546

Daily-news social platform for **City 546 News HD** ("Words with Mirza"). There's one Admin and everyone else is a public reader. Content is often **Urdu** (RTL, Nastaliq).
See `README.md` for full setup, the API reference and feature docs. This file covers what to know before changing code.

## Stack & layout
- **npm workspaces**: `backend/` (Node ≥20.19, ESM, Express 5, `pg`, zod 4) and `frontend/` (Vite 8, React 19, Tailwind v4, React Router 7 data router).
- `database/migrations/NNN_*.sql` hold ordered SQL migrations, tracked in `schema_migrations`. `database/seed/` holds the sample posts.
- The root `.env` is shared by the backend, the scripts and the Vite proxy. `.env.example` documents every variable.

## Commands (run from the repo root)
```bash
npm run dev          # API :5000 + Vite :5173 (Vite auto-bumps to 5174/5175 if taken)
npm test             # backend node:test suites — hits the REAL DB in DATABASE_URL
npm run lint         # frontend ESLint (react-hooks v7 rules are strict)
npm run build        # frontend production build
npm run db:up        # Docker Postgres (container city546-db)
npm run db:migrate && npm run db:seed
```
Before finishing a change, run `npm test`, `npm run lint` and `npm run build`.

## Local environment (Windows)
- The Windows PostgreSQL service is stopped, and starting it needs admin rights, so **use the Docker DB** (`city546-db`).
- Port 5173 is usually taken by the user's **other project (`D:\E\emp-all\fms`)**. Never kill its processes.
- The user often runs `npm run dev` for city546 in their own terminal. Check port owners before killing anything, and only stop process trees you started.
- `.claude/launch.json` runs Vite alone on :5180 for the preview pane. The API must already be running on :5000.
- Git Bash heredocs mangle `\uXXXX` escapes and BOM characters. Edit files containing those with the Edit/Write tools, not `sed`/heredocs.
- Admin credentials live in `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`). Point to that file; never echo the values.

## Production / hosting
- Production runs as **one process**: `npm run build && npm start`. With `NODE_ENV=production`, Express serves `frontend/dist` (SPA fallback for non-`/api` paths) and `UPLOAD_DIR`. It sits behind a reverse proxy (`trust proxy` = 1) and needs HTTPS, because of the auth cookie and the TikTok OAuth redirect.
- Uploads are **files on disk, not in the DB**. Any host needs a persistent disk/volume for `UPLOAD_DIR`, and backups must cover both the DB (`pg_dump`) and that folder.
- Hosted Postgres needing TLS (Neon, Supabase, RDS…): set `DATABASE_SSL=true`. For a DB on the same VPS, keep it `false` and bind Postgres to localhost only.
- New DB: run `npm run db:migrate`, or restore a `pg_dump` into an empty DB instead of migrating.
- **Never run `npm test` against a production `DATABASE_URL`**, because it writes and deletes real rows and changes `ai_settings`. Keep `AI_PROVIDER=mock|none` in production unless the user approves the Claude API cost.
- **Hosting: Railway** (decided 2026-09-28). The user starts on the **free trial** ($5 one-time credit, 30 days, 1 GB RAM, 500 MB volume); Hobby ($5/mo, about $7–10 with usage) comes after.
  - `railway.json` holds the config: the build runs only `npm run build`, because Railpack installs dependencies itself; a second `npm ci` fails with EBUSY on its cached `node_modules/.vite`, pre-deploy runs `db:migrate && db:seed`, and the health check is `/api/health`.
  - Postgres is a Railway service in the same project. `DATABASE_URL=${{Postgres.DATABASE_URL}}` (private network, `DATABASE_SSL=false`). Uploads go on a volume at `/data` with `UPLOAD_DIR=/data/uploads`.
  - The full variable list and steps are in README §6, "Deploying to Railway". Keep that section in sync when env vars change.
  - The user creates the Railway account and enters secrets themselves.
- **The frontend is on Vercel**, and `frontend/vercel.json` proxies `/api/*` and `/uploads/*` to Railway, plus the SPA fallback. Readers only see the Vercel domain, which is required because the auth cookie is `SameSite=Strict`.
  - Don't set `VITE_API_URL` on Vercel.
  - Railway needs `TRUST_PROXY=2` (two proxy hops: Vercel, then Railway's edge).
  - Rewrite caching is off for `/api`; never let authenticated JSON be CDN-cached.

## Backend conventions
- Route → `validate(schema, source)` (zod) → controller. Parsed input is on **`req.valid.body|query|params`**, because Express 5 makes `req.query` read-only.
- Responses always go through `ok(res, data, { status, meta, message })`. Errors: throw `HttpError` helpers (`badRequest`, `notFound`, …). Express 5 forwards async rejections, so no wrapper is needed.
- Models are raw parameterised SQL in `src/models/`. Use `withTransaction()` for multi-statement transactions (never `BEGIN` through the pool).
- **Authorization is server-side**: every admin route uses `adminOnly` (`authenticate` + `requireAdmin`), and the user is re-loaded from the DB on each request. Hiding UI is never the protection.
- Invariants enforced in the DB (keep them):
  - exactly one `ADMIN` (partial unique index)
  - `password_hash` must be bcrypt (CHECK constraint)
  - post image = `http(s)` URL or `/uploads/<uuid>.<jpg|png|gif|webp>`
- Auth uses an httpOnly `city546_token` cookie. The JS-readable `city546_session=1` cookie is only a hint so the SPA can skip `/auth/me`; it grants nothing.
- Migrations are **additive**. Never edit an applied migration; add `NNN+1`.
- Uploads (`src/services/uploadService.js`):
  - the type is detected from magic bytes; SVG is never accepted
  - files get random names
  - post delete/update removes uploads no longer referenced by any post

## Frontend conventions
- Data fetching uses `useAsync(fn, deps)` / `usePostFeed`. Stale data is kept while reloading, and `loading` is derived from a deps key.
  - Don't `setState` synchronously in effects, and don't read refs during render (the lint rules fail on both).
- Brand tokens (navy, gold, red, blue) and fonts are Tailwind v4 `@theme` values in `src/index.css`. Dark mode is class-based.
- `Button` has a base `inline-flex`. To hide it responsively use `max-sm:hidden`, not `hidden sm:inline-flex`.
- Fixed-position overlays inside the header must be **portalled**, because `backdrop-blur` creates a containing block. `Modal` always portals to `<body>`, which also keeps it out of parent `<form>`s.
- **Urdu text**: use `textProps(text)` from `utils/format.js` for `dir="rtl"`, `lang` and the Nastaliq classes on user content.
- Images: always render through `SmartImage` or `mediaUrl()`. Portrait covers use `fitPortrait` on story pages.
- Admin pages are lazy-loaded chunks. Public readers never download admin code.

## AI writing-style subsystem (`backend/src/ai/`, `frontend/src/components/ai/`)
- **Flow:** reference accounts/posts → versioned style profile (`ai_style_profiles`, one active) → `generate-post` with admin facts, the profile and about 3 retrieved examples → the admin reviews and publishes.
- **AI output is never published automatically.** Keep it that way.
- **Providers:** `aiService.js` is the only entry point. `AI_PROVIDER=anthropic|mock|none`.
  - The Claude provider uses the official `@anthropic-ai/sdk`: `claude-opus-5`, adaptive thinking, `output_config.format` JSON schema, and `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`).
  - Anthropic has no embeddings, so retrieval uses Postgres full-text search.
- **All model output is re-validated** with zod in `ai/schemas.js`. Untrusted text (reference posts, profile, admin input) is wrapped with `fence()` in `ai/prompts.js`.
  - `ai/guards.js` flags numbers not present in the admin's notes, and text copied from the examples.
- **Style analysis** runs only when reference data changes or on an explicit rebuild. It is async and single-flight, and the UI polls `/api/ai/style`. Never analyse per post.
- **Feed import** (`feedImporter.js`) reads only public RSS/Atom feeds, with SSRF protection. Do not add scraping, login-based fetching, or any bypass of rate limits/CAPTCHAs.
- **Meta connectors** (`ai/connectors/metaConnector.js`) use only the official Graph API (`META_GRAPH_VERSION`, default `v26.0`):
  - Facebook reads `/{page}/posts`; Instagram uses `business_discovery` via `META_IG_USER_ID`.
  - Requests are signed with `appsecret_proof` when `META_APP_SECRET` is set, and paging stops at 85% of the rate-limit headers.
  - The token must never appear in responses or logs.
  - Reference accounts with `source_type = 'api'` are allowed only for facebook/instagram (CHECK constraint, migration 004).
  - Tests use an injected fake `fetchImpl` via `setMetaConnectorForTesting`; never call Meta for real in tests.
- **TikTok connector** (`ai/connectors/tiktokConnector.js` + `tiktokService.js`) uses Login Kit OAuth plus the Display API (`/v2/video/list/`). It can only read accounts that authorised the app.
  - Don't add the Research API: TikTok restricts it to non-commercial academic use.
  - Tokens live in `platform_connections`, encrypted with `services/secretBox.js` (AES-256-GCM); a CHECK constraint requires the `v1:` envelope.
  - Access tokens (24 h) auto-refresh with a single-flight lock; a failed refresh sets `status = reauth_required`.
  - The OAuth callback (`routes/oauthRoutes.js`, `/api/oauth/tiktok/callback`) is public, because the SameSite=Strict cookie is not sent on it. It authenticates with a one-time `oauth_states` row and redirects only to `/admin/ai-style`.
  - Tests use `setTikTokConnectorForTesting` with a fake `fetchImpl`.
- **Tests and local dev use the `mock` provider** (no cost). **Don't make real Claude API calls without the user's approval**, because they cost money.
- **News graphic:** the AI writes only the text. `NewsGraphic.jsx` renders a 1080×1350 card from the admin's own photos.
  - Export goes through `exportGraphic.js`: `html-to-image` `toSvg`, then our own canvas rasterise.
  - Don't switch back to `toPng`/`toCanvas`: their internal `img.decode().then(rAF)` can hang forever.
  - Fonts are bundled via `@fontsource/*` `?url` imports and embedded as data URLs (CSP-safe).

## Testing notes
- Test files run **sequentially** (`--test-concurrency=1`) because they share one database; parallel runs race on reference data and settings.
- `backend/tests/*.test.js` spin up the app on a random port and log in with `.env` admin credentials. They clean up the rows and files they create. AI tests save and restore `ai_settings` and the active profile.
- Browser checks: log in via `fetch('/api/auth/login')` in the page. Set React inputs through the native value setter and dispatch `input`.
