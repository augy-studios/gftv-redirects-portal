-- Migration: Add is_editor column and gftvlinks_profileviews table
-- Run this against your Supabase project SQL editor

-- 1. Add is_editor column to gftvlinks_users
--    Existing approved users become Editors (is_editor = true)
--    Unapproved users remain pending (is_editor = false)
ALTER TABLE gftvlinks_users
  ADD COLUMN IF NOT EXISTS is_editor BOOLEAN NOT NULL DEFAULT FALSE;

-- Migrate existing approved non-admin users to Editor role
UPDATE gftvlinks_users
  SET is_editor = TRUE
  WHERE is_approved = TRUE;

-- 2. Create profile views table
CREATE TABLE IF NOT EXISTS gftvlinks_profileviews (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    viewer_id   UUID NOT NULL REFERENCES gftvlinks_users(id) ON DELETE CASCADE,
    viewed_id   UUID NOT NULL REFERENCES gftvlinks_users(id) ON DELETE CASCADE,
    viewed_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (viewer_id, viewed_id)
);

-- Index for fast lookup of viewers for a given profile, sorted by most recent
CREATE INDEX IF NOT EXISTS idx_profileviews_viewed_id
  ON gftvlinks_profileviews (viewed_id, viewed_at DESC);
