-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: rename session_id → user_id across all tables
-- Run in: Supabase → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════════════

-- Likes
ALTER TABLE likes         RENAME COLUMN session_id TO user_id;

-- Dislikes
ALTER TABLE dislikes      RENAME COLUMN session_id TO user_id;

-- Reports
ALTER TABLE reports       RENAME COLUMN session_id TO user_id;

-- Subscriptions (also updates the unique constraint automatically)
ALTER TABLE subscriptions RENAME COLUMN session_id TO user_id;

-- Comment votes (also updates the unique constraint automatically)
ALTER TABLE comment_votes RENAME COLUMN session_id TO user_id;
