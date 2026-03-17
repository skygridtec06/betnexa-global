-- BETNEXA - Comprehensive Supabase Database Schema
-- This schema handles all user data, bets, games, transactions, and admin operations
-- All changes via admin panel sync to database and reflect on user side in real-time

-- ==================== ENUMS ====================
-- ENUMS already created - skipping to avoid duplicate type errors
-- CREATE TYPE user_role AS ENUM ('user', 'admin');
-- CREATE TYPE game_status AS ENUM ('upcoming', 'live', 'finished', 'cancelled');
-- CREATE TYPE bet_status AS ENUM ('Open', 'Won', 'Lost', 'Void', 'Closed');
-- CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
-- CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'bet_placement', 'bet_payout', 'admin_adjustment');

-- ==================== USERS TABLE ====================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  email TEXT UNIQUE,
  account_balance DECIMAL(15,2) DEFAULT 0.00,
  deposited_balance DECIMAL(15,2) DEFAULT 0.00,
  winnings_balance DECIMAL(15,2) DEFAULT 0.00,
  total_bets INTEGER DEFAULT 0,
  total_winnings DECIMAL(15,2) DEFAULT 0.00,
  is_admin BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP NULL,
  withdrawal_activated BOOLEAN DEFAULT FALSE,
  withdrawal_activation_date TIMESTAMP NULL,
  role user_role DEFAULT 'user',
  status TEXT DEFAULT 'active', -- active, suspended, banned, inactive
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL -- Soft delete
);

-- ==================== GAMES TABLE ====================
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT UNIQUE NOT NULL, -- Reference ID from context
  league TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_odds DECIMAL(6,2) NOT NULL,
  draw_odds DECIMAL(6,2) NOT NULL,
  away_odds DECIMAL(6,2) NOT NULL,
  status game_status DEFAULT 'upcoming',
  time TEXT,
  home_score INTEGER DEFAULT NULL,
  away_score INTEGER DEFAULT NULL,
  minute INTEGER DEFAULT 0,
  is_kickoff_started BOOLEAN DEFAULT FALSE,
  kickoff_start_time TIMESTAMP NULL,
  game_paused BOOLEAN DEFAULT FALSE,
  kickoff_paused_at TIMESTAMP NULL,
  is_halftime BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  finished_at TIMESTAMP NULL
);

-- ==================== MARKETS TABLE ====================
CREATE TABLE IF NOT EXISTS markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  market_type TEXT NOT NULL, -- 1X2, BTTS, O/U, DC, HT/FT, CS
  market_key TEXT NOT NULL, -- bttsYes, over25, cs10, etc.
  odds DECIMAL(8,2) NOT NULL,
  is_settled BOOLEAN DEFAULT FALSE,
  settled_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(game_id, market_key)
);

-- ==================== BETS TABLE ====================
CREATE TABLE IF NOT EXISTS bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id TEXT UNIQUE NOT NULL, -- Unique bet identifier (e.g., ABC123)
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stake DECIMAL(15,2) NOT NULL,
  potential_win DECIMAL(15,2) NOT NULL,
  total_odds DECIMAL(10,2) NOT NULL,
  status bet_status DEFAULT 'Open',
  placed_at TIMESTAMP DEFAULT NOW(),
  settled_at TIMESTAMP NULL,
  bet_date TEXT,
  bet_time TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==================== BET SELECTIONS TABLE ====================
CREATE TABLE IF NOT EXISTS bet_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id UUID NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  market_key TEXT NOT NULL, -- betting selection key (home, draw, away, etc.)
  market_type TEXT NOT NULL, -- 1X2, BTTS, O/U, DC, HT/FT, CS
  market_label TEXT NOT NULL, -- Human-readable label
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  odds DECIMAL(8,2) NOT NULL,
  outcome TEXT DEFAULT 'pending', -- pending, won, lost
  result BOOLEAN NULL, -- NULL=pending, TRUE=won, FALSE=lost
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==================== TRANSACTIONS TABLE ====================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bet_id UUID REFERENCES bets(id) ON DELETE SET NULL,
  type transaction_type NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  balance_before DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  status transaction_status DEFAULT 'pending',
  method TEXT, -- M-Pesa, Bank Transfer, Admin Adjustment, etc.
  phone_number TEXT,
  external_reference TEXT, -- PayHero reference
  mpesa_receipt TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP NULL,
  failed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==================== PAYMENTS TABLE ====================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT UNIQUE NOT NULL,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  phone_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, sent, completed, failed
  external_reference TEXT UNIQUE,
  mpesa_receipt TEXT,
  result_code TEXT,
  result_description TEXT,
  is_activation BOOLEAN DEFAULT FALSE, -- Withdrawal activation payment
  created_at TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  failed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==================== ADMIN LOGS TABLE ====================
-- Tracks all admin actions for audit trail
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- user_edit, user_delete, game_update, balance_adjust, etc.
  target_type TEXT NOT NULL, -- user, game, bet, transaction
  target_id UUID NOT NULL,
  changes JSONB, -- What was changed (old values and new values)
  description TEXT,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==================== BALANCE HISTORY TABLE ====================
-- Tracks all balance changes for audit
CREATE TABLE IF NOT EXISTS balance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance_before DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  change DECIMAL(15,2) NOT NULL,
  reason TEXT NOT NULL, -- deposit, withdrawal, bet_loss, bet_win, admin_adjustment
  reference_id UUID, -- Transaction ID or Admin Log ID
  created_by TEXT, -- system, user, admin_name
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==================== SETTINGS TABLE ====================
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  data_type TEXT, -- string, number, boolean, json
  description TEXT,
  is_editable BOOLEAN DEFAULT TRUE,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==================== SESSION TABLE ====================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity_at TIMESTAMP DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

-- ==================== ANNOUNCEMENTS TABLE ====================
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- info, warning, promotion, maintenance
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP,
  expires_at TIMESTAMP NULL
);

-- ==================== INDEXES ====================

-- Users
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_is_admin ON users(is_admin);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Games
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_league ON games(league);
CREATE INDEX idx_games_created_at ON games(created_at);

-- Markets
CREATE INDEX idx_markets_game_id ON markets(game_id);
CREATE INDEX idx_markets_market_type ON markets(market_type);

-- Bets
CREATE INDEX idx_bets_user_status ON bets(user_id, status);
CREATE INDEX idx_bets_created_at ON bets(created_at DESC);

-- Bet Selections
CREATE INDEX idx_bet_selections_outcome ON bet_selections(outcome);

-- Transactions
CREATE INDEX idx_transactions_user_type ON transactions(user_id, type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- Payments
CREATE INDEX idx_payments_completed_at ON payments(completed_at);

-- ==================== FUNCTIONS ====================

-- Function to update user balance
CREATE OR REPLACE FUNCTION update_user_balance(
  p_user_id UUID,
  p_amount DECIMAL,
  p_reason TEXT
)
RETURNS DECIMAL AS $$
DECLARE
  v_old_balance DECIMAL;
  v_new_balance DECIMAL;
BEGIN
  -- Get current balance
  SELECT account_balance INTO v_old_balance FROM users WHERE id = p_user_id;
  
  -- Calculate new balance
  v_new_balance := v_old_balance + p_amount;
  
  -- Update user balance
  UPDATE users 
  SET account_balance = v_new_balance, updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Record in balance history
  INSERT INTO balance_history (user_id, balance_before, balance_after, change, reason, created_by)
  VALUES (p_user_id, v_old_balance, v_new_balance, p_amount, p_reason, 'system');
  
  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- Function to settle a bet
CREATE OR REPLACE FUNCTION settle_bet(
  p_bet_id UUID,
  p_status bet_status,
  p_payout_amount DECIMAL DEFAULT 0
)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_stake DECIMAL;
BEGIN
  -- Get bet details
  SELECT user_id, stake INTO v_user_id, v_stake FROM bets WHERE id = p_bet_id;
  
  -- Update bet status
  UPDATE bets 
  SET status = p_status, settled_at = NOW(), updated_at = NOW()
  WHERE id = p_bet_id;
  
  -- If won, add payout to balance
  IF p_status = 'Won' THEN
    PERFORM update_user_balance(v_user_id, p_payout_amount, 'bet_payout');
    
    -- Update user winnings
    UPDATE users 
    SET total_winnings = total_winnings + p_payout_amount
    WHERE id = v_user_id;
    
  -- If lost, winnings already deducted at bet placement
  ELSIF p_status = 'Lost' THEN
    PERFORM update_user_balance(v_user_id, 0, 'bet_lost');
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to log admin action
CREATE OR REPLACE FUNCTION log_admin_action(
  p_admin_id UUID,
  p_action TEXT,
  p_target_type TEXT,
  p_target_id UUID,
  p_changes JSONB,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO admin_logs (admin_id, action, target_type, target_id, changes, description)
  VALUES (p_admin_id, p_action, p_target_type, p_target_id, p_changes, p_description)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ==================== TRIGGERS ====================

-- Trigger to update user updated_at
CREATE OR REPLACE FUNCTION update_user_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_update
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_user_timestamp();

-- Trigger to update game updated_at
CREATE OR REPLACE FUNCTION update_game_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_games_update
BEFORE UPDATE ON games
FOR EACH ROW
EXECUTE FUNCTION update_game_timestamp();

-- Trigger to update bet updated_at
CREATE OR REPLACE FUNCTION update_bet_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bets_update
BEFORE UPDATE ON bets
FOR EACH ROW
EXECUTE FUNCTION update_bet_timestamp();

-- Trigger to auto-update transaction completed_at
CREATE OR REPLACE FUNCTION update_transaction_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
  ELSIF NEW.status = 'failed' AND OLD.status != 'failed' THEN
    NEW.failed_at = NOW();
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_transactions_update
BEFORE UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_transaction_completion();

-- ==================== INITIAL SETTINGS ====================

INSERT INTO settings (setting_key, setting_value, data_type, description) VALUES
('min_deposit', '500', 'number', 'Minimum deposit amount in KSH'),
('min_stake', '500', 'number', 'Minimum stake amount in KSH'),
('max_stake', '1000000', 'number', 'Maximum stake amount in KSH'),
('withdrawal_fee_percentage', '0', 'number', 'Withdrawal fee percentage'),
('deposit_fee_percentage', '0', 'number', 'Deposit fee percentage'),
('bet_settlement_timeout', '600', 'number', 'Bet settlement polling timeout in seconds'),
('max_odds_multiplier', '10', 'number', 'Maximum odds multiplier for a single bet'),
('maintenance_mode', 'false', 'boolean', 'Site maintenance mode'),
('auto_settle_bets', 'true', 'boolean', 'Auto settle bets when game finishes'),
('payhero_api_key', '', 'string', 'PayHero API Key'),
('payhero_api_secret', '', 'string', 'PayHero API Secret')
ON CONFLICT (setting_key) DO NOTHING;

-- ==================== ROW LEVEL SECURITY (RLS) ====================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own data and admins can view all
CREATE POLICY "users_select" ON users
  FOR SELECT USING (
    auth.uid()::uuid = id OR
    (SELECT is_admin FROM users WHERE id = auth.uid()::uuid) = TRUE
  );

-- Policy: Users can update their own data
CREATE POLICY "users_update" ON users
  FOR UPDATE USING (auth.uid()::uuid = id);

-- Policy: Games are readable by all authenticated users
CREATE POLICY "games_select" ON games
  FOR SELECT USING (TRUE);

-- Policy: Only admins can update games
CREATE POLICY "games_update" ON games
  FOR UPDATE USING ((SELECT is_admin FROM users WHERE id = auth.uid()::uuid) = TRUE);

-- Policy: Users can view their own bets, admins can view all
CREATE POLICY "bets_select" ON bets
  FOR SELECT USING (
    auth.uid()::uuid = user_id OR
    (SELECT is_admin FROM users WHERE id = auth.uid()::uuid) = TRUE
  );

-- Policy: Users can view their own transactions
CREATE POLICY "transactions_select" ON transactions
  FOR SELECT USING (
    auth.uid()::uuid = user_id OR
    (SELECT is_admin FROM users WHERE id = auth.uid()::uuid) = TRUE
  );

-- Policy: Only admins can view admin logs
CREATE POLICY "admin_logs_select" ON admin_logs
  FOR SELECT USING ((SELECT is_admin FROM users WHERE id = auth.uid()::uuid) = TRUE);

-- ==================== VIEW FOR ACTIVE BETS ====================

CREATE OR REPLACE VIEW active_bets AS
SELECT 
  b.id,
  b.bet_id,
  b.user_id,
  u.username,
  b.stake,
  b.potential_win,
  b.total_odds,
  b.status,
  COUNT(bs.id) as selections_count,
  b.placed_at,
  b.created_at
FROM bets b
LEFT JOIN bet_selections bs ON b.id = bs.bet_id
LEFT JOIN users u ON b.user_id = u.id
WHERE b.status = 'Open'
GROUP BY b.id, b.bet_id, b.user_id, u.username, b.stake, b.potential_win, b.total_odds, b.status, b.placed_at, b.created_at;

-- ==================== VIEW FOR USER BALANCE SUMMARY ====================

CREATE OR REPLACE VIEW user_balance_summary AS
SELECT 
  u.id,
  u.username,
  u.account_balance,
  u.total_bets,
  u.total_winnings,
  COUNT(DISTINCT b.id) as active_bets_count,
  COALESCE(SUM(CASE WHEN b.status = 'Won' THEN b.potential_win ELSE 0 END), 0) as pending_winnings
FROM users u
LEFT JOIN bets b ON u.id = b.user_id AND b.status = 'Open'
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.username, u.account_balance, u.total_bets, u.total_winnings;

-- ==================== VIEW FOR TRANSACTION SUMMARY ====================

CREATE OR REPLACE VIEW transaction_summary AS
SELECT 
  u.id,
  u.username,
  COUNT(t.id) as total_transactions,
  SUM(CASE WHEN t.type = 'deposit' THEN t.amount ELSE 0 END) as total_deposits,
  SUM(CASE WHEN t.type = 'withdrawal' THEN t.amount ELSE 0 END) as total_withdrawals,
  SUM(CASE WHEN t.type = 'bet_placement' THEN t.amount ELSE 0 END) as total_bet_stakes,
  SUM(CASE WHEN t.type = 'bet_payout' THEN t.amount ELSE 0 END) as total_payouts
FROM users u
LEFT JOIN transactions t ON u.id = t.user_id AND t.status = 'completed'
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.username;

-- ==================== GRANT PERMISSIONS ====================

-- Grant basic permissions (adjust based on your auth setup)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- For admin operations, use service role in backend
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
