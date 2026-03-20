-- Migration: Add manually_edited_at column to markets table
-- This tracks when an admin has manually edited market odds
-- to prevent live sync from overwriting admin edits

ALTER TABLE markets ADD COLUMN IF NOT EXISTS manually_edited_at TIMESTAMP NULL;

-- Add comment to document the purpose
COMMENT ON COLUMN markets.manually_edited_at IS 'Timestamp when admin manually edited this market odds. If recent, live sync will skip overwriting.';
