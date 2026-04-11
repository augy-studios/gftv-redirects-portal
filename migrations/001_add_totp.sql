-- Migration: Add TOTP 2FA support
-- Run these statements in your Supabase SQL editor.

-- 1. Add totp_secret column to users table (nullable — NULL means 2FA disabled)
ALTER TABLE gftvlinks_users
ADD COLUMN IF NOT EXISTS totp_secret text;

-- 2. Temporary challenge tokens issued during login when 2FA is required
--    (expires in 10 minutes, deleted on first use)
CREATE TABLE IF NOT EXISTS gftvlinks_totp_challenges (
  token       text        PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES gftvlinks_users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_totp_challenges_user
  ON gftvlinks_totp_challenges(user_id);

-- 3. Trusted devices — "don't ask for 2FA on this device for 30 days"
CREATE TABLE IF NOT EXISTS gftvlinks_trusted_devices (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES gftvlinks_users(id) ON DELETE CASCADE,
  device_token  text        UNIQUE NOT NULL,
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_token
  ON gftvlinks_trusted_devices(device_token);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user
  ON gftvlinks_trusted_devices(user_id);
