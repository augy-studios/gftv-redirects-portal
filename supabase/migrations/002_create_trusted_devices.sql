-- Create trusted devices table for 2FA device trust
-- Run this in your Supabase SQL editor to create the table

CREATE TABLE IF NOT EXISTS gftvhello_trusted_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES gftvhello_users(id) ON DELETE CASCADE,
    device_token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Index for efficient lookup by user_id (listing devices per user)
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON gftvhello_trusted_devices(user_id);

-- Index for efficient lookup by device_token during login
CREATE INDEX IF NOT EXISTS idx_trusted_devices_device_token ON gftvhello_trusted_devices(device_token);
