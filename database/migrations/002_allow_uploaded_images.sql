-- ─────────────────────────────────────────────────────────────
-- 002 — Allow images uploaded to this server.
-- image_url may now be an external http(s) URL OR a local path
-- produced by the upload endpoint, e.g. /uploads/<uuid>.jpg
-- ─────────────────────────────────────────────────────────────

ALTER TABLE posts DROP CONSTRAINT posts_image_url_format;

ALTER TABLE posts ADD CONSTRAINT posts_image_url_format CHECK (
  LENGTH(image_url) <= 2048 AND (
    image_url ~* '^https?://'
    OR image_url ~ '^/uploads/[0-9a-f-]{36}\.(jpg|png|gif|webp)$'
  )
);
