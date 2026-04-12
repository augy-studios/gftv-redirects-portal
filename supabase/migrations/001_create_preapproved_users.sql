-- Create the pre-approved users table
-- Run this in your Supabase SQL editor to create the table

CREATE TABLE IF NOT EXISTS gftvlinks_users_preapproved (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    preapproved_role TEXT NOT NULL CHECK (preapproved_role IN ('viewer', 'editor')),
    user_id UUID REFERENCES gftvlinks_users(id) ON DELETE SET NULL,
    preapproved_by UUID REFERENCES gftvlinks_users(id) ON DELETE SET NULL,
    preapproved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at TIMESTAMPTZ
);
