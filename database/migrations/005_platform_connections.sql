-- ─────────────────────────────────────────────────────────────
-- 005 — OAuth platform connections (TikTok Login Kit / Display API)
--   platform_connections  accounts that authorised city546 (tokens encrypted at rest)
--   oauth_states          one-time CSRF state values for in-flight authorisations
-- ─────────────────────────────────────────────────────────────

CREATE TABLE platform_connections (
  id                  BIGSERIAL     PRIMARY KEY,
  provider            VARCHAR(20)   NOT NULL,
  external_user_id    VARCHAR(200)  NOT NULL,           -- TikTok open_id
  display_name        VARCHAR(200),
  username            VARCHAR(100),
  avatar_url          TEXT,
  scopes              TEXT,
  access_token_enc    TEXT          NOT NULL,
  refresh_token_enc   TEXT,
  access_expires_at   TIMESTAMPTZ,
  refresh_expires_at  TIMESTAMPTZ,
  status              VARCHAR(20)   NOT NULL DEFAULT 'active',
  last_error          TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_connections_provider CHECK (provider IN ('tiktok')),
  CONSTRAINT platform_connections_status   CHECK (status IN ('active', 'reauth_required')),
  -- Tokens must be stored encrypted (secretBox "v1:" envelope), never in plaintext.
  CONSTRAINT platform_connections_access_encrypted  CHECK (access_token_enc LIKE 'v1:%'),
  CONSTRAINT platform_connections_refresh_encrypted CHECK (refresh_token_enc IS NULL OR refresh_token_enc LIKE 'v1:%'),
  CONSTRAINT platform_connections_unique UNIQUE (provider, external_user_id)
);

CREATE TRIGGER platform_connections_set_updated_at
  BEFORE UPDATE ON platform_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE oauth_states (
  state       VARCHAR(64)  PRIMARY KEY,
  provider    VARCHAR(20)  NOT NULL,
  user_id     BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Reference accounts synced through a connection
ALTER TABLE reference_accounts
  ADD COLUMN connection_id BIGINT REFERENCES platform_connections (id) ON DELETE SET NULL;

ALTER TABLE reference_accounts DROP CONSTRAINT reference_accounts_api_platform;
ALTER TABLE reference_accounts ADD CONSTRAINT reference_accounts_api_platform
  CHECK (source_type <> 'api' OR platform IN ('facebook', 'instagram', 'tiktok'));
