-- Create gftvlinks_linkvisits table to record every link visit with a timestamp
CREATE TABLE IF NOT EXISTS gftvlinks_linkvisits (
    id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    link_id    UUID        NOT NULL REFERENCES gftvlinks_links(id) ON DELETE CASCADE,
    slug       TEXT        NOT NULL,
    visited_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index to speed up per-link visit counts
CREATE INDEX IF NOT EXISTS gftvlinks_linkvisits_link_id_idx
    ON gftvlinks_linkvisits (link_id);

-- RPC: insert a visit row, recount from gftvlinks_linkvisits, then sync access_count
CREATE OR REPLACE FUNCTION record_link_visit(p_link_id UUID, p_slug TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_count BIGINT;
BEGIN
    INSERT INTO gftvlinks_linkvisits (link_id, slug, visited_at)
    VALUES (p_link_id, p_slug, now());

    SELECT COUNT(*) INTO v_count
    FROM gftvlinks_linkvisits
    WHERE link_id = p_link_id;

    UPDATE gftvlinks_links
    SET access_count = v_count
    WHERE id = p_link_id;
END;
$$;
