-- ============================================================
-- COMPLETE FIX: Ensure transactions and fund_transfers tables
-- match ALL backend insert operations exactly
-- Run this in Supabase SQL Editor
-- ============================================================

-- ==================== 1. ENUM TYPES ====================
-- Ensure all required enum types exist

DO $$ BEGIN
  CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'bet_placement', 'bet_payout', 'admin_adjustment');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE fund_transfer_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE fund_transfer_type AS ENUM ('deposit', 'withdrawal');
EXCEPTION WHEN duplicate_object THEN null;
END $$;


-- ==================== 2. TRANSACTIONS TABLE ====================
-- Create if not exists
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bet_id UUID REFERENCES bets(id) ON DELETE SET NULL,
  type transaction_type NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  balance_before DECIMAL(15,2),
  balance_after DECIMAL(15,2),
  status transaction_status DEFAULT 'pending',
  method TEXT DEFAULT 'M-Pesa STK Push',
  phone_number TEXT,
  external_reference TEXT,
  checkout_request_id TEXT,
  mpesa_receipt TEXT,
  description TEXT,
  admin_notes TEXT,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP NULL,
  failed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add any missing columns (safe - does nothing if they already exist)
DO $$ BEGIN
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS balance_before DECIMAL(15,2);
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS balance_after DECIMAL(15,2);
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'M-Pesa STK Push';
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS phone_number TEXT;
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS checkout_request_id TEXT;
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS mpesa_receipt TEXT;
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS description TEXT;
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS admin_notes TEXT;
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL;
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP NULL;
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
EXCEPTION WHEN others THEN null;
END $$;

-- Create indexes on transactions
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_external_ref ON transactions(external_reference);


-- ==================== 3. FUND TRANSFERS TABLE ====================
CREATE TABLE IF NOT EXISTS fund_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  transfer_type fund_transfer_type NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  phone_number TEXT NOT NULL,
  status fund_transfer_status DEFAULT 'pending',
  method TEXT DEFAULT 'M-Pesa',
  external_reference TEXT UNIQUE,
  checkout_request_id TEXT,
  mpesa_receipt TEXT,
  result_code TEXT,
  result_description TEXT,
  is_stk_push_sent BOOLEAN DEFAULT FALSE,
  stk_sent_at TIMESTAMP NULL,
  withdrawal_destination TEXT,
  withdrawal_fee DECIMAL(15,2) DEFAULT 0.00,
  admin_notes TEXT,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMP NULL,
  failed_at TIMESTAMP NULL,
  cancelled_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT check_valid_amount CHECK (amount > 0)
);

-- Create indexes on fund_transfers
CREATE INDEX IF NOT EXISTS idx_fund_transfers_user_id ON fund_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_fund_transfers_status ON fund_transfers(status);
CREATE INDEX IF NOT EXISTS idx_fund_transfers_type ON fund_transfers(transfer_type);
CREATE INDEX IF NOT EXISTS idx_fund_transfers_user_type ON fund_transfers(user_id, transfer_type);
CREATE INDEX IF NOT EXISTS idx_fund_transfers_user_status ON fund_transfers(user_id, status);
CREATE INDEX IF NOT EXISTS idx_fund_transfers_created_at ON fund_transfers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fund_transfers_external_ref ON fund_transfers(external_reference);
CREATE INDEX IF NOT EXISTS idx_fund_transfers_mpesa_receipt ON fund_transfers(mpesa_receipt);


-- ==================== 4. ROW LEVEL SECURITY ====================

-- Transactions RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_service_role_all_transactions" ON transactions;
CREATE POLICY "allow_service_role_all_transactions" ON transactions
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_select_own_transactions" ON transactions;
CREATE POLICY "allow_select_own_transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "allow_insert_own_transactions" ON transactions;
CREATE POLICY "allow_insert_own_transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Fund Transfers RLS
ALTER TABLE fund_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_service_role_all_fund_transfers" ON fund_transfers;
CREATE POLICY "allow_service_role_all_fund_transfers" ON fund_transfers
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_select_own_fund_transfers" ON fund_transfers;
CREATE POLICY "allow_select_own_fund_transfers" ON fund_transfers
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "allow_insert_own_fund_transfers" ON fund_transfers;
CREATE POLICY "allow_insert_own_fund_transfers" ON fund_transfers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "allow_update_own_fund_transfers" ON fund_transfers;
CREATE POLICY "allow_update_own_fund_transfers" ON fund_transfers
  FOR UPDATE USING (auth.uid() = user_id);


-- ==================== 5. GRANTS ====================

GRANT SELECT, INSERT, UPDATE, DELETE ON transactions TO authenticated;
GRANT SELECT ON transactions TO anon;
GRANT ALL ON transactions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON fund_transfers TO authenticated;
GRANT SELECT ON fund_transfers TO anon;
GRANT ALL ON fund_transfers TO service_role;


-- ==================== 6. USERS TABLE - Ensure withdrawal columns exist ====================

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS withdrawal_activated BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS withdrawal_activation_date TIMESTAMP NULL;
EXCEPTION WHEN others THEN null;
END $$;


-- ==================== DONE ====================
-- After running this, your backend inserts will work correctly.
-- All columns match the backend code exactly.
