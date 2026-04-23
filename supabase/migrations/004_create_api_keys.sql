-- Create API keys table for Editor/Admin users to access the public API
-- Run this in your Supabase SQL editor to create the table

CREATE TABLE IF NOT EXISTS gftvhello_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES gftvhello_users(id) ON DELETE CASCADE,
    api_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one API key per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_user_id ON gftvhello_api_keys(user_id);

-- Index for efficient lookup by api_key during API requests
CREATE INDEX IF NOT EXISTS idx_api_keys_api_key ON gftvhello_api_keys(api_key);
