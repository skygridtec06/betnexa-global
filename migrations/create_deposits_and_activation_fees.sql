-- =============================================
-- Migration: Create deposits and activation_fees tables
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. DEPOSITS TABLE — stores only regular M-Pesa deposits (NOT activation/priority fees)
CREATE TABLE IF NOT EXISTS deposits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  phone_number TEXT,
  external_reference TEXT,
  checkout_request_id TEXT,
  mpesa_receipt TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  method TEXT DEFAULT 'M-Pesa STK Push',
  description TEXT,
  admin_notes TEXT,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for deposits
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_external_reference ON deposits(external_reference);
CREATE INDEX IF NOT EXISTS idx_deposits_created_at ON deposits(created_at DESC);

-- 2. ACTIVATION_FEES TABLE — stores KSH 1000 activation fees and KSH 399 priority fees
CREATE TABLE IF NOT EXISTS activation_fees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  fee_type TEXT NOT NULL CHECK (fee_type IN ('activation', 'priority')),
  amount NUMERIC(12,2) NOT NULL,
  phone_number TEXT,
  external_reference TEXT,
  checkout_request_id TEXT,
  mpesa_receipt TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  related_withdrawal_id TEXT,  -- For priority fees: links to the withdrawal being prioritized
  method TEXT DEFAULT 'M-Pesa STK Push',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for activation_fees
CREATE INDEX IF NOT EXISTS idx_activation_fees_user_id ON activation_fees(user_id);
CREATE INDEX IF NOT EXISTS idx_activation_fees_fee_type ON activation_fees(fee_type);
CREATE INDEX IF NOT EXISTS idx_activation_fees_status ON activation_fees(status);
CREATE INDEX IF NOT EXISTS idx_activation_fees_external_reference ON activation_fees(external_reference);
CREATE INDEX IF NOT EXISTS idx_activation_fees_created_at ON activation_fees(created_at DESC);

-- 3. RLS Policies (disable RLS since we use service key)
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE activation_fees ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on deposits" ON deposits
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on activation_fees" ON activation_fees
  FOR ALL USING (true) WITH CHECK (true);

-- Allow authenticated users to read their own records
CREATE POLICY "Users can view own deposits" ON deposits
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view own activation_fees" ON activation_fees
  FOR SELECT USING (auth.uid()::text = user_id);
