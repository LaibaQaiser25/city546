-- ─────────────────────────────────────────────────────────────
-- 001 — Initial schema for city546
--   users       : exactly one ADMIN account
--   categories  : news categories
--   posts       : news stories (+ JSONB content blocks)
-- ─────────────────────────────────────────────────────────────

-- Keeps updated_at current on every UPDATE
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Users ────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('ADMIN');

CREATE TABLE users (
  id             BIGSERIAL    PRIMARY KEY,
  email          VARCHAR(255) NOT NULL,
  name           VARCHAR(100) NOT NULL DEFAULT 'city546 Admin',
  password_hash  TEXT         NOT NULL,
  role           user_role    NOT NULL DEFAULT 'ADMIN',
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+$'),
  -- bcrypt hashes always start with $2a$, $2b$ or $2y$ — guards against plaintext
  CONSTRAINT users_password_is_bcrypt CHECK (password_hash ~ '^\$2[aby]\$\d{2}\$.{53}$')
);

-- Case-insensitive unique email
CREATE UNIQUE INDEX users_email_lower_key ON users (LOWER(email));

-- Enforces "there is exactly one Admin" at the database level
CREATE UNIQUE INDEX users_single_admin_key ON users (role) WHERE role = 'ADMIN';

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Categories ───────────────────────────────────────────────
CREATE TABLE categories (
  id          SERIAL       PRIMARY KEY,
  name        VARCHAR(60)  NOT NULL UNIQUE,
  slug        VARCHAR(60)  NOT NULL UNIQUE,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT categories_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

INSERT INTO categories (name, slug, sort_order) VALUES
  ('Breaking',      'breaking',      1),
  ('Local News',    'local',         2),
  ('National',      'national',      3),
  ('World',         'world',         4),
  ('Sports',        'sports',        5),
  ('Business',      'business',      6),
  ('Technology',    'technology',    7),
  ('Entertainment', 'entertainment', 8),
  ('Health',        'health',        9);

-- ── Posts ────────────────────────────────────────────────────
CREATE TABLE posts (
  id            BIGSERIAL     PRIMARY KEY,
  image_url     TEXT          NOT NULL,
  heading       VARCHAR(200)  NOT NULL,
  description   TEXT          NOT NULL,
  -- Extra story blocks appended with the (+) actions:
  --   [{ "id": "...", "type": "image",     "url": "...", "caption": "..." },
  --    { "id": "...", "type": "heading",   "text": "..." },
  --    { "id": "...", "type": "paragraph", "text": "..." }]
  blocks        JSONB         NOT NULL DEFAULT '[]'::jsonb,
  category_id   INTEGER       REFERENCES categories (id) ON DELETE SET NULL,
  author_id     BIGINT        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  published     BOOLEAN       NOT NULL DEFAULT TRUE,
  views         INTEGER       NOT NULL DEFAULT 0,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- 'simple' config: language-agnostic, so Urdu and English both index
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', COALESCE(heading, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(description, '')), 'B')
  ) STORED,

  CONSTRAINT posts_heading_not_blank     CHECK (LENGTH(BTRIM(heading)) >= 3),
  CONSTRAINT posts_description_not_blank CHECK (LENGTH(BTRIM(description)) >= 10),
  CONSTRAINT posts_description_length    CHECK (LENGTH(description) <= 20000),
  CONSTRAINT posts_image_url_format      CHECK (image_url ~* '^https?://' AND LENGTH(image_url) <= 2048),
  CONSTRAINT posts_blocks_is_array       CHECK (jsonb_typeof(blocks) = 'array'),
  CONSTRAINT posts_views_non_negative    CHECK (views >= 0),
  CONSTRAINT posts_published_has_date    CHECK (NOT published OR published_at IS NOT NULL)
);

CREATE INDEX posts_feed_idx       ON posts (published, published_at DESC, id DESC);
CREATE INDEX posts_created_idx    ON posts (created_at DESC);
CREATE INDEX posts_category_idx   ON posts (category_id);
CREATE INDEX posts_author_idx     ON posts (author_id);
CREATE INDEX posts_search_idx     ON posts USING GIN (search_vector);

CREATE TRIGGER posts_set_updated_at
  BEFORE UPDATE OF image_url, heading, description, blocks, category_id, published ON posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
