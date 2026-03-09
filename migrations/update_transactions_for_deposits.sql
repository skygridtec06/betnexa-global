-- Update transactions table to support full deposit tracking
-- This migration adds missing columns and ensures transactions properly
-- store all deposit data for admin visibility

-- Add missing columns to transactions table if they don't exist
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS checkout_request_id TEXT,
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'M-Pesa STK Push',
ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Update the phone_number column to allow NULL (it comes later from callback)
ALTER TABLE transactions
ALTER COLUMN phone_number DROP NOT NULL;

-- Create index for efficient admin transaction queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_external_reference ON transactions(external_reference);
CREATE INDEX IF NOT EXISTS idx_transactions_checkout_request_id ON transactions(checkout_request_id);

-- Create composite index for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_status_date ON transactions(user_id, status, created_at DESC);

-- Enable realtime for transactions table so admin sees updates live
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;

-- Add comment documenting the deposits workflow
COMMENT ON TABLE transactions IS 'Stores all user transactions including deposits, withdrawals, and bets. 
For deposits: status starts as pending when STK push sent, updated when payment callback received or admin confirms.';

COMMENT ON COLUMN transactions.status IS 'pending (STK sent), completed (payment confirmed), failed (user cancelled/timeout), cancelled';
COMMENT ON COLUMN transactions.checkout_request_id IS 'PayHero checkout request ID for deposit tracking';
COMMENT ON COLUMN transactions.external_reference IS 'External payment reference for tracking across systems';
COMMENT ON COLUMN transactions.admin_notes IS 'Admin notes when marking deposits as completed';
