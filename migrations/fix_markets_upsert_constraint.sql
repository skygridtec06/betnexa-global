-- Migration: Ensure unique constraint on markets table for UPSERT
-- This enables proper upsert functionality when updating specific market odds
-- while preserving other markets for the same game

-- Add unique constraint on (game_id, market_key) if it doesn't exist
-- First, check if constraint exists and create if needed
DO $$
BEGIN
  -- Try to add the unique constraint
  ALTER TABLE markets
  ADD CONSTRAINT unique_game_market_key UNIQUE (game_id, market_key);
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists, that's fine
  NULL;
WHEN OTHERS THEN
  -- If there's another error, log it but continue
  RAISE NOTICE 'Note: Could not add unique constraint (may already exist): %', SQLERRM;
END $$;

-- Add comment to document the constraint
COMMENT ON CONSTRAINT unique_game_market_key ON markets 
IS 'Ensures each game has one unique entry per market type. Used for UPSERT operations to update specific markets without losing others.';

-- Verify the markets table structure has what we need
ALTER TABLE markets ADD COLUMN IF NOT EXISTS manually_edited_at TIMESTAMP NULL;
COMMENT ON COLUMN markets.manually_edited_at IS 'Timestamp when admin manually edited this market odds. If recent, live sync will skip overwriting.';
