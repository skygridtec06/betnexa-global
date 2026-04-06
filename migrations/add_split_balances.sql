-- Migration: Add split balances (stakeable and withdrawable)
-- Description: Split account_balance into stakeable_balance (deposits) and withdrawable_balance (winnings)

BEGIN;

-- Add new balance columns
ALTER TABLE users
ADD COLUMN IF NOT EXISTS stakeable_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS withdrawable_balance NUMERIC DEFAULT 0;

-- Migrate existing data: split current account_balance 50/50 as initial migration
-- (In production, you might want to put all existing balance into stakeable_balance)
UPDATE users
SET 
  stakeable_balance = account_balance,
  withdrawable_balance = 0
WHERE stakeable_balance = 0 AND withdrawable_balance = 0;

-- Add comment for clarity
COMMENT ON COLUMN users.stakeable_balance IS 'Amount available for betting (from deposits)';
COMMENT ON COLUMN users.withdrawable_balance IS 'Amount available for withdrawal (from winnings)';

COMMIT;
