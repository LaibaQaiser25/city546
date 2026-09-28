-- ─────────────────────────────────────────────────────────────
-- 004 — Reference accounts can be synced through an official platform API
--       (Meta Graph API for Facebook Pages and Instagram Business/Creator accounts).
-- ─────────────────────────────────────────────────────────────

ALTER TABLE reference_accounts DROP CONSTRAINT reference_accounts_source;
ALTER TABLE reference_accounts ADD CONSTRAINT reference_accounts_source
  CHECK (source_type IN ('manual', 'feed', 'api'));

-- The official-API source is only available for platforms that have a connector.
ALTER TABLE reference_accounts ADD CONSTRAINT reference_accounts_api_platform
  CHECK (source_type <> 'api' OR platform IN ('facebook', 'instagram'));
