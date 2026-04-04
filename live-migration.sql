-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New Query)

ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_live  boolean DEFAULT false;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_short boolean DEFAULT false;

-- Shorts must be 60 seconds or less.
-- The app enforces this on upload, but the DB constraint is the safety net.
-- Duration is stored as a display string (e.g. '0:47'), so we add a separate
-- numeric column for the constraint check.
ALTER TABLE videos ADD COLUMN IF NOT EXISTS duration_seconds integer;

ALTER TABLE videos DROP CONSTRAINT IF EXISTS shorts_max_duration;
ALTER TABLE videos ADD CONSTRAINT shorts_max_duration
  CHECK (NOT is_short OR duration_seconds <= 60);

-- Index for fast shorts feed queries
CREATE INDEX IF NOT EXISTS idx_videos_is_short ON videos (is_short, created_at DESC)
  WHERE is_short = true;
