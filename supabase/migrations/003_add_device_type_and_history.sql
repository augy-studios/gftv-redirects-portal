-- =================================================================
-- Migration 003: Device Type Tracking & Link History
-- Run this in your Supabase SQL editor
-- =================================================================

-- =================================================================
-- PART 1: Add device_type column to gftvlinks_linkvisits
-- =================================================================

ALTER TABLE gftvlinks_linkvisits
    ADD COLUMN IF NOT EXISTS device_type TEXT NOT NULL DEFAULT 'Others';

-- Set existing records to 'Others' (already handled by DEFAULT above,
-- but explicit update for any rows that slipped through)
UPDATE gftvlinks_linkvisits
SET device_type = 'Others'
WHERE device_type IS NULL OR device_type NOT IN ('Desktop', 'Tablet', 'Mobile', 'Others');

-- Add check constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_linkvisit_device_type'
    ) THEN
        ALTER TABLE gftvlinks_linkvisits
            ADD CONSTRAINT chk_linkvisit_device_type
            CHECK (device_type IN ('Desktop', 'Tablet', 'Mobile', 'Others'));
    END IF;
END $$;

-- =================================================================
-- PART 2: Update record_link_visit RPC to accept device_type
-- IMPORTANT: This rewrites the function body. The INSERT statement
-- below assumes your gftvlinks_linkvisits table has columns:
--   link_id (UUID), slug (TEXT), device_type (TEXT)
-- and a created_at TIMESTAMPTZ with DEFAULT NOW().
-- Adjust column names if your schema differs.
-- =================================================================

CREATE OR REPLACE FUNCTION record_link_visit(
    p_link_id     UUID,
    p_slug        TEXT,
    p_device_type TEXT DEFAULT 'Others'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO gftvlinks_linkvisits (link_id, slug, device_type, visited_at)
    VALUES (p_link_id, p_slug, p_device_type, NOW());

    UPDATE gftvlinks_links
    SET access_count = COALESCE(access_count, 0) + 1
    WHERE id = p_link_id;
END;
$$;

-- =================================================================
-- PART 3: Analytics RPC functions
-- Uses 'visited_at' as the timestamp column in gftvlinks_linkvisits.
-- =================================================================

-- Device type breakdown for a link
CREATE OR REPLACE FUNCTION get_link_device_breakdown(p_link_id UUID)
RETURNS TABLE(device_type TEXT, cnt BIGINT)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT device_type, COUNT(*) AS cnt
    FROM gftvlinks_linkvisits
    WHERE link_id = p_link_id
    GROUP BY device_type;
$$;

-- Daily click counts for the past 7 days (UTC)
CREATE OR REPLACE FUNCTION get_link_daily_clicks(p_link_id UUID)
RETURNS TABLE(day DATE, cnt BIGINT)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        (visited_at AT TIME ZONE 'UTC')::DATE AS day,
        COUNT(*) AS cnt
    FROM gftvlinks_linkvisits
    WHERE link_id = p_link_id
      AND visited_at >= (NOW() - INTERVAL '7 days')
    GROUP BY (visited_at AT TIME ZONE 'UTC')::DATE
    ORDER BY day;
$$;

-- All-time daily click counts (used for CSV download)
CREATE OR REPLACE FUNCTION get_link_all_daily_clicks(p_link_id UUID)
RETURNS TABLE(day DATE, cnt BIGINT)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        (visited_at AT TIME ZONE 'UTC')::DATE AS day,
        COUNT(*) AS cnt
    FROM gftvlinks_linkvisits
    WHERE link_id = p_link_id
    GROUP BY (visited_at AT TIME ZONE 'UTC')::DATE
    ORDER BY day;
$$;

-- Traffic heatmap: clicks by day-of-week (0=Sun … 6=Sat) and hour (0-23, UTC)
CREATE OR REPLACE FUNCTION get_link_traffic_heatmap(p_link_id UUID)
RETURNS TABLE(dow SMALLINT, hr SMALLINT, cnt BIGINT)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        EXTRACT(DOW  FROM visited_at AT TIME ZONE 'UTC')::SMALLINT AS dow,
        EXTRACT(HOUR FROM visited_at AT TIME ZONE 'UTC')::SMALLINT AS hr,
        COUNT(*) AS cnt
    FROM gftvlinks_linkvisits
    WHERE link_id = p_link_id
    GROUP BY dow, hr
    ORDER BY dow, hr;
$$;

-- =================================================================
-- PART 4: Link History table
-- =================================================================

CREATE TABLE IF NOT EXISTS gftvlinks_linkhistory (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id     UUID        NOT NULL REFERENCES gftvlinks_links(id) ON DELETE CASCADE,
    event_type  TEXT        NOT NULL,
    description TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linkhistory_link_id
    ON gftvlinks_linkhistory(link_id);

CREATE INDEX IF NOT EXISTS idx_linkhistory_created_at
    ON gftvlinks_linkhistory(created_at DESC);

-- =================================================================
-- PART 5: Trigger to auto-record link history on changes
-- =================================================================

CREATE OR REPLACE FUNCTION fn_record_link_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_owner TEXT;
BEGIN
    -- On INSERT: record creation event
    IF TG_OP = 'INSERT' THEN
        INSERT INTO gftvlinks_linkhistory (link_id, event_type, description, created_at)
        VALUES (
            NEW.id,
            'created',
            'https://gftv.asia/' || NEW.slug || ' created for ' || NEW.destination,
            COALESCE(NEW.created_at, NOW())
        );
    END IF;

    -- On UPDATE: check what changed
    IF TG_OP = 'UPDATE' THEN
        -- Active/inactive status change
        IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
            INSERT INTO gftvlinks_linkhistory (link_id, event_type, description)
            VALUES (
                NEW.id,
                'status_change',
                'Link Status was updated from ' ||
                CASE WHEN OLD.is_active THEN 'ACTIVE' ELSE 'INACTIVE' END ||
                ' to ' ||
                CASE WHEN NEW.is_active THEN 'ACTIVE' ELSE 'INACTIVE' END
            );
        END IF;

        -- Ownership transfer
        IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
            SELECT username INTO v_new_owner
            FROM gftvhello_users   -- was gftvlinks_users before prefix migration
            WHERE id = NEW.user_id;

            INSERT INTO gftvlinks_linkhistory (link_id, event_type, description)
            VALUES (
                NEW.id,
                'ownership_change',
                'Link Ownership was transferred to @' || COALESCE(v_new_owner, 'unknown')
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_history ON gftvlinks_links;
CREATE TRIGGER trg_link_history
    AFTER INSERT OR UPDATE ON gftvlinks_links
    FOR EACH ROW EXECUTE FUNCTION fn_record_link_history();

-- =================================================================
-- PART 6: Backfill history for all existing links
-- Only inserts if a 'created' record does not already exist
-- =================================================================

INSERT INTO gftvlinks_linkhistory (link_id, event_type, description, created_at)
SELECT
    l.id,
    'created',
    'https://gftv.asia/' || l.slug || ' created for ' || l.destination,
    l.created_at
FROM gftvlinks_links l
WHERE NOT EXISTS (
    SELECT 1 FROM gftvlinks_linkhistory h
    WHERE h.link_id = l.id AND h.event_type = 'created'
);
