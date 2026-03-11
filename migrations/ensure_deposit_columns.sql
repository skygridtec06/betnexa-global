-- Run this in Supabase SQL Editor to ensure all deposit-related columns exist
-- This is safe to run multiple times

-- Add missing columns to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS checkout_request_id TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS mpesa_receipt TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'M-Pesa STK Push';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS balance_before DECIMAL(15,2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS balance_after DECIMAL(15,2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS completed_by UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Ensure payments table exists for STK push tracking
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  phone_number TEXT,
  external_reference TEXT UNIQUE,
  checkout_request_id TEXT UNIQUE,
  status TEXT DEFAULT 'PENDING',
  mpesa_receipt_number TEXT,
  result_code TEXT,
  result_desc TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Ensure RLS is disabled for service key access (server uses service key)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DROP POLICY IF EXISTS "Service role full access to transactions" ON transactions;
CREATE POLICY "Service role full access to transactions" ON transactions
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access to payments" ON payments;
CREATE POLICY "Service role full access to payments" ON payments
  FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON transactions TO authenticated;
GRANT ALL ON transactions TO service_role;
GRANT ALL ON payments TO authenticated;
GRANT ALL ON payments TO service_role;

-- Verify: show current columns
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'transactions' ORDER BY ordinal_position;
