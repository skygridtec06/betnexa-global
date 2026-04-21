-- Migration: Add is_banned column to users table
-- This allows admins to ban users from the platform

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT NULL;

-- Create index for efficient ban status queries
CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned);
CREATE INDEX IF NOT EXISTS idx_users_banned_at ON users(banned_at);

-- Verify columns were added
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'users' AND column_name IN ('is_banned', 'banned_at', 'ban_reason');
