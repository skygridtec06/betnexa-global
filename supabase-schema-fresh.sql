-- BETNEXA - Comprehensive Supabase Database Schema (Fresh Start)
-- This schema handles all user data, bets, games, transactions, and admin operations
-- All changes via admin panel sync to database and reflect on user side in real-time

-- ==================== ENUMS ====================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE game_status AS ENUM ('upcoming', 'live', 'finished', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE bet_status AS ENUM ('Open', 'Won', 'Lost', 'Void', 'Closed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'bet_placement', 'bet_payout', 'admin_adjustment');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

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
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL
);

-- ==================== GAMES TABLE ====================
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT UNIQUE NOT NULL,
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
  market_type TEXT NOT NULL,
  market_key TEXT NOT NULL,
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
  bet_id TEXT UNIQUE NOT NULL,
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
  market_key TEXT NOT NULL,
  market_type TEXT NOT NULL,
  market_label TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  odds DECIMAL(8,2) NOT NULL,
  outcome TEXT DEFAULT 'pending',
  result BOOLEAN NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==================== TRANSACTIONS TABLE ====================
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

-- ==================== PAYMENTS TABLE ====================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT UNIQUE NOT NULL,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  phone_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  external_reference TEXT UNIQUE,
  mpesa_receipt TEXT,
  result_code TEXT,
  result_description TEXT,
  is_activation BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  failed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==================== ADMIN LOGS TABLE ====================
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  changes JSONB,
  description TEXT,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==================== BALANCE HISTORY TABLE ====================
CREATE TABLE IF NOT EXISTS balance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance_before DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  change DECIMAL(15,2) NOT NULL,
  reason TEXT NOT NULL,
  reference_id UUID,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==================== SETTINGS TABLE ====================
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  data_type TEXT,
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
  type TEXT DEFAULT 'info',
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP,
  expires_at TIMESTAMP NULL
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_league ON games(league);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);
CREATE INDEX IF NOT EXISTS idx_markets_game_id ON markets(game_id);
CREATE INDEX IF NOT EXISTS idx_markets_market_type ON markets(market_type);
CREATE INDEX IF NOT EXISTS idx_bets_user_status ON bets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bets_created_at ON bets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bet_selections_outcome ON bet_selections(outcome);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_completed_at ON payments(completed_at);

-- ==================== FUNCTIONS ====================

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
  SELECT account_balance INTO v_old_balance FROM users WHERE id = p_user_id;
  v_new_balance := v_old_balance + p_amount;
  UPDATE users 
  SET account_balance = v_new_balance, updated_at = NOW()
  WHERE id = p_user_id;
  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_admin_action(
  p_admin_id UUID,
  p_action TEXT,
  p_target_type TEXT,
  p_target_id UUID,
  p_changes JSONB
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO admin_logs (admin_id, action, target_type, target_id, changes)
  VALUES (p_admin_id, p_action, p_target_type, p_target_id, p_changes)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ==================== TRIGGERS ====================

CREATE OR REPLACE FUNCTION update_user_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trigger_users_update
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_user_timestamp();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE OR REPLACE FUNCTION update_game_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trigger_games_update
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_game_timestamp();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE OR REPLACE FUNCTION update_bet_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trigger_bets_update
  BEFORE UPDATE ON bets
  FOR EACH ROW
  EXECUTE FUNCTION update_bet_timestamp();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE OR REPLACE FUNCTION auto_update_transaction_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
  END IF;
  IF NEW.status = 'failed' AND OLD.status != 'failed' THEN
    NEW.failed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trigger_transaction_completion
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_transaction_completed();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ==================== ROW LEVEL SECURITY (RLS) ====================
-- DISABLED: Custom authentication used (phone + password), not Supabase Auth
-- Backend service role can access all tables without RLS restrictions
-- This allows the backend API to work with custom authentication

-- Disable RLS on all tables since we use custom auth with backend service role
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE games DISABLE ROW LEVEL SECURITY;
ALTER TABLE markets DISABLE ROW LEVEL SECURITY;
ALTER TABLE bets DISABLE ROW LEVEL SECURITY;
ALTER TABLE bet_selections DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE balance_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE announcements DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

-- ==================== VIEWS ====================

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

-- ==================== INITIAL DATA ====================

INSERT INTO settings (setting_key, setting_value, data_type, description)
VALUES 
('bets_max_number', '15', 'number', 'Maximum number of bets per slip'),
('stake_minimum', '100', 'number', 'Minimum stake in KES'),
('stake_maximum', '500000', 'number', 'Maximum stake in KES'),
('withdrawal_minimum', '500', 'number', 'Minimum withdrawal amount'),
('deposit_minimum', '100', 'number', 'Minimum deposit amount'),
('bet_settlement_timeout', '600', 'number', 'Bet settlement polling timeout in seconds'),
('max_odds_multiplier', '10', 'number', 'Maximum odds multiplier for a single bet'),
('maintenance_mode', 'false', 'boolean', 'Site maintenance mode'),
('auto_settle_bets', 'true', 'boolean', 'Auto settle bets when game finishes'),
('payhero_api_key', '', 'string', 'PayHero API Key'),
('payhero_api_secret', '', 'string', 'PayHero API Secret')
ON CONFLICT (setting_key) DO NOTHING;

-- ==================== GRANT PERMISSIONS ====================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO service_role;
