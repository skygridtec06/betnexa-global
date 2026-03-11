-- Migration: Add dedicated fund_transfers table for deposits and withdrawals
-- This table will track all deposit and withdrawal transactions
-- It complements the existing transactions table with more specific fields for fund transfer tracking

-- Create fund transfer status enum if not exists
DO $$ BEGIN
  CREATE TYPE fund_transfer_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create fund transfer type enum if not exists
DO $$ BEGIN
  CREATE TYPE fund_transfer_type AS ENUM ('deposit', 'withdrawal');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ==================== FUND TRANSFERS TABLE ====================
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
  
  -- Payment Reference
  external_reference TEXT UNIQUE,
  checkout_request_id TEXT,
  mpesa_receipt TEXT,
  result_code TEXT,
  result_description TEXT,
  
  -- For deposits
  is_stk_push_sent BOOLEAN DEFAULT FALSE,
  stk_sent_at TIMESTAMP NULL,
  
  -- For withdrawals
  withdrawal_destination TEXT,
  withdrawal_fee DECIMAL(15,2) DEFAULT 0.00,
  
  -- Admin notes and tracking
  admin_notes TEXT,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMP NULL,
  failed_at TIMESTAMP NULL,
  cancelled_at TIMESTAMP NULL,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes for quick lookups
  CONSTRAINT check_valid_amount CHECK (amount > 0)
);

-- ==================== INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_fund_transfers_user_id ON fund_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_fund_transfers_status ON fund_transfers(status);
CREATE INDEX IF NOT EXISTS idx_fund_transfers_type ON fund_transfers(transfer_type);
CREATE INDEX IF NOT EXISTS idx_fund_transfers_user_type ON fund_transfers(user_id, transfer_type);
CREATE INDEX IF NOT EXISTS idx_fund_transfers_user_status ON fund_transfers(user_id, status);
CREATE INDEX IF NOT EXISTS idx_fund_transfers_created_at ON fund_transfers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fund_transfers_external_ref ON fund_transfers(external_reference);
CREATE INDEX IF NOT EXISTS idx_fund_transfers_mpesa_receipt ON fund_transfers(mpesa_receipt);

-- ==================== FUNCTION: Auto-sync fund_transfers to transactions ====================
CREATE OR REPLACE FUNCTION sync_fund_transfer_to_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- When a fund_transfer is created or updated, ensure corresponding transaction exists
  IF NEW.id IS NOT NULL THEN
    -- Check if transaction already linked
    IF NEW.transaction_id IS NULL THEN
      -- Update fund_transfer with transaction_id if a matching transaction exists
      UPDATE fund_transfers
      SET transaction_id = t.id,
          updated_at = NOW()
      FROM transactions t
      WHERE t.user_id = NEW.user_id
        AND t.amount = NEW.amount
        AND t.type = CASE 
          WHEN NEW.transfer_type = 'deposit' THEN 'deposit'
          WHEN NEW.transfer_type = 'withdrawal' THEN 'withdrawal'
        END
        AND t.status = CASE 
          WHEN NEW.status = 'pending' THEN 'pending'
          WHEN NEW.status = 'completed' THEN 'completed'
          WHEN NEW.status = 'failed' THEN 'failed'
          WHEN NEW.status = 'cancelled' THEN 'cancelled'
          WHEN NEW.status IN ('processing') THEN 'pending'
        END
        AND fund_transfers.id = NEW.id
        AND fund_transfers.transaction_id IS NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fund_transfer_sync_trigger
AFTER INSERT OR UPDATE ON fund_transfers
FOR EACH ROW
EXECUTE FUNCTION sync_fund_transfer_to_transaction();

-- ==================== FUNCTION: Update fund_transfers when transactions change ====================
CREATE OR REPLACE FUNCTION update_fund_transfer_on_transaction_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When a transaction status changes, update the corresponding fund_transfer
  IF NEW.type IN ('deposit', 'withdrawal') AND NEW.transaction_id IS NOT NULL THEN
    UPDATE fund_transfers
    SET status = CASE 
          WHEN NEW.status = 'pending' THEN 'pending'
          WHEN NEW.status = 'completed' THEN 'completed'
          WHEN NEW.status = 'failed' THEN 'failed'
          WHEN NEW.status = 'cancelled' THEN 'cancelled'
        END,
        updated_at = NOW(),
        completed_at = CASE WHEN NEW.status = 'completed' THEN NOW() ELSE completed_at END,
        failed_at = CASE WHEN NEW.status = 'failed' THEN NOW() ELSE failed_at END
    WHERE transaction_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger will be created in the main schema if transactions table exists
-- Uncomment below if applying this after transactions table is created:
-- CREATE TRIGGER transaction_update_fund_transfer_trigger
-- AFTER UPDATE ON transactions
-- FOR EACH ROW
-- EXECUTE FUNCTION update_fund_transfer_on_transaction_change();

-- ==================== ROW LEVEL SECURITY ====================
-- Enable RLS on fund_transfers table
ALTER TABLE fund_transfers ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow authenticated users to INSERT their own fund transfers
CREATE POLICY IF NOT EXISTS "allow_insert_own_fund_transfers" ON fund_transfers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 2: Allow authenticated users to SELECT their own fund transfers
CREATE POLICY IF NOT EXISTS "allow_select_own_fund_transfers" ON fund_transfers
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 3: Allow authenticated users to UPDATE their own fund transfers
CREATE POLICY IF NOT EXISTS "allow_update_own_fund_transfers" ON fund_transfers
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy 4: Allow service role (backend) full access (for admin operations and callbacks)
CREATE POLICY IF NOT EXISTS "allow_service_role_all_operations" ON fund_transfers
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ==================== GRANTS ====================
GRANT SELECT, INSERT, UPDATE, DELETE ON fund_transfers TO authenticated;
GRANT SELECT ON fund_transfers TO anon;
GRANT ALL ON fund_transfers TO service_role;

-- ==================== COMMENTS ====================
COMMENT ON TABLE fund_transfers IS 'Dedicated table for tracking all deposit and withdrawal transactions, linked to transactions and payments tables';
COMMENT ON COLUMN fund_transfers.transfer_type IS 'Type of fund transfer: deposit (user funding account) or withdrawal (user withdrawing funds)';
COMMENT ON COLUMN fund_transfers.status IS 'Current status of the fund transfer (pending, processing, completed, failed, cancelled)';
COMMENT ON COLUMN fund_transfers.external_reference IS 'PayHero or external payment provider reference ID';
COMMENT ON COLUMN fund_transfers.mpesa_receipt IS 'M-Pesa transaction receipt for completed payments';
COMMENT ON COLUMN fund_transfers.withdrawal_destination IS 'M-Pesa phone number or account for withdrawal';
