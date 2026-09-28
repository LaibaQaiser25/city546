-- ─────────────────────────────────────────────────────────────
-- 003 — AI style-learning subsystem (additive only; no existing table changes)
--   reference_accounts   public accounts whose posts define the house style
--   reference_posts      style examples imported from those accounts
--   ai_style_profiles    versioned, structured style profile learned by the AI
--   ai_generations       AI drafts + admin feedback (for history / improvement)
--   ai_generation_logs   per-call usage log (tokens, status, latency)
--   ai_settings          single-row settings (feedback learning, news-graphic branding)
-- ─────────────────────────────────────────────────────────────

-- ── Reference accounts ───────────────────────────────────────
CREATE TABLE reference_accounts (
  id                   BIGSERIAL     PRIMARY KEY,
  platform             VARCHAR(20)   NOT NULL,
  account_name         VARCHAR(120)  NOT NULL,
  profile_url          TEXT,
  description          VARCHAR(500),
  -- Where posts come from: 'manual' (admin-supplied dataset) or 'feed' (public RSS/Atom feed)
  source_type          VARCHAR(10)   NOT NULL DEFAULT 'manual',
  feed_url             TEXT,
  external_account_id  VARCHAR(200),
  active               BOOLEAN       NOT NULL DEFAULT TRUE,
  last_synced_at       TIMESTAMPTZ,
  last_sync_error      TEXT,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT reference_accounts_platform CHECK (platform IN ('facebook','instagram','youtube','tiktok','x','website','other')),
  CONSTRAINT reference_accounts_source   CHECK (source_type IN ('manual','feed')),
  CONSTRAINT reference_accounts_feed_url CHECK (source_type <> 'feed' OR feed_url ~* '^https?://'),
  CONSTRAINT reference_accounts_profile_url CHECK (profile_url IS NULL OR profile_url ~* '^https?://')
);
CREATE UNIQUE INDEX reference_accounts_unique_name ON reference_accounts (platform, LOWER(account_name));

CREATE TRIGGER reference_accounts_set_updated_at
  BEFORE UPDATE ON reference_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Reference posts ──────────────────────────────────────────
-- Only what style analysis needs is stored: text, optional image link, date, small metadata.
CREATE TABLE reference_posts (
  id                    BIGSERIAL    PRIMARY KEY,
  reference_account_id  BIGINT       NOT NULL REFERENCES reference_accounts (id) ON DELETE CASCADE,
  external_post_id      VARCHAR(300),
  content               TEXT         NOT NULL,
  content_hash          CHAR(64)     NOT NULL,
  image_url             TEXT,
  published_at          TIMESTAMPTZ,
  metadata              JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  search_vector         TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
  CONSTRAINT reference_posts_content_length CHECK (LENGTH(BTRIM(content)) BETWEEN 1 AND 20000),
  CONSTRAINT reference_posts_metadata_obj   CHECK (jsonb_typeof(metadata) = 'object')
);
-- Re-importing the same post is a no-op
CREATE UNIQUE INDEX reference_posts_unique_hash ON reference_posts (reference_account_id, content_hash);
CREATE UNIQUE INDEX reference_posts_unique_external
  ON reference_posts (reference_account_id, external_post_id) WHERE external_post_id IS NOT NULL;
CREATE INDEX reference_posts_account_idx ON reference_posts (reference_account_id, published_at DESC NULLS LAST);
CREATE INDEX reference_posts_search_idx  ON reference_posts USING GIN (search_vector);

CREATE TRIGGER reference_posts_set_updated_at
  BEFORE UPDATE ON reference_posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Style profiles (versioned) ───────────────────────────────
CREATE TABLE ai_style_profiles (
  id                    BIGSERIAL    PRIMARY KEY,
  name                  VARCHAR(100) NOT NULL DEFAULT 'House style',
  version               INTEGER      NOT NULL,
  profile_data          JSONB,
  status                VARCHAR(10)  NOT NULL DEFAULT 'building',
  error                 TEXT,
  is_active             BOOLEAN      NOT NULL DEFAULT FALSE,
  source_post_count     INTEGER      NOT NULL DEFAULT 0,
  source_account_count  INTEGER      NOT NULL DEFAULT 0,
  -- Fingerprint of the reference data used, to tell when the profile is out of date
  source_fingerprint    CHAR(32),
  provider              VARCHAR(30),
  model                 VARCHAR(100),
  last_generated_at     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_style_profiles_status CHECK (status IN ('building','ready','failed')),
  CONSTRAINT ai_style_profiles_ready_has_data CHECK (status <> 'ready' OR profile_data IS NOT NULL),
  CONSTRAINT ai_style_profiles_version_unique UNIQUE (version)
);
-- At most one active profile
CREATE UNIQUE INDEX ai_style_profiles_single_active ON ai_style_profiles (is_active) WHERE is_active;

CREATE TRIGGER ai_style_profiles_set_updated_at
  BEFORE UPDATE ON ai_style_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Generations (drafts + feedback) ──────────────────────────
CREATE TABLE ai_generations (
  id               BIGSERIAL    PRIMARY KEY,
  user_id          BIGINT       REFERENCES users (id) ON DELETE SET NULL,
  profile_id       BIGINT       REFERENCES ai_style_profiles (id) ON DELETE SET NULL,
  parent_id        BIGINT       REFERENCES ai_generations (id) ON DELETE SET NULL,  -- set for regenerations
  input            JSONB        NOT NULL,
  output           JSONB        NOT NULL,
  warnings         JSONB        NOT NULL DEFAULT '[]'::jsonb,
  feedback         VARCHAR(10),
  final_post_id    BIGINT       REFERENCES posts (id) ON DELETE SET NULL,
  final_content    JSONB,
  edit_ratio       REAL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_generations_feedback CHECK (feedback IS NULL OR feedback IN ('good','bad')),
  CONSTRAINT ai_generations_edit_ratio CHECK (edit_ratio IS NULL OR edit_ratio BETWEEN 0 AND 1)
);
CREATE INDEX ai_generations_created_idx ON ai_generations (created_at DESC);
CREATE INDEX ai_generations_feedback_idx ON ai_generations (feedback) WHERE feedback IS NOT NULL;

CREATE TRIGGER ai_generations_set_updated_at
  BEFORE UPDATE ON ai_generations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Usage log ────────────────────────────────────────────────
CREATE TABLE ai_generation_logs (
  id             BIGSERIAL    PRIMARY KEY,
  user_id        BIGINT       REFERENCES users (id) ON DELETE SET NULL,
  operation      VARCHAR(30)  NOT NULL,
  provider       VARCHAR(30)  NOT NULL,
  model          VARCHAR(100),
  input_tokens   INTEGER      NOT NULL DEFAULT 0,
  output_tokens  INTEGER      NOT NULL DEFAULT 0,
  status         VARCHAR(10)  NOT NULL,
  error          TEXT,
  duration_ms    INTEGER,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_generation_logs_status CHECK (status IN ('success','error'))
);
CREATE INDEX ai_generation_logs_created_idx ON ai_generation_logs (created_at DESC);

-- ── Settings (single row) ────────────────────────────────────
CREATE TABLE ai_settings (
  id          SMALLINT     PRIMARY KEY DEFAULT 1,
  data        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_settings_single_row CHECK (id = 1),
  CONSTRAINT ai_settings_data_obj CHECK (jsonb_typeof(data) = 'object')
);
INSERT INTO ai_settings (id) VALUES (1);

CREATE TRIGGER ai_settings_set_updated_at
  BEFORE UPDATE ON ai_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
