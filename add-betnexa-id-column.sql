-- Add betnexa_id column to users table for offline M-Pesa deposits
-- Format: XNNN where X = consonant (no vowels), N = digit 2-9

-- Add the column
ALTER TABLE users ADD COLUMN IF NOT EXISTS betnexa_id TEXT UNIQUE;

-- Create index for fast lookups (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_users_betnexa_id ON users(UPPER(betnexa_id));
