-- Create user_presence table for real-time activity tracking
CREATE TABLE IF NOT EXISTS user_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT UNIQUE NOT NULL,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  login_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'online' CHECK (status IN ('online', 'idle', 'offline')),
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_user_presence_user_id ON user_presence(user_id);
CREATE INDEX idx_user_presence_last_activity ON user_presence(last_activity DESC);
CREATE INDEX idx_user_presence_status ON user_presence(status);
CREATE INDEX idx_user_presence_session_id ON user_presence(session_id);

-- Enable realtime for user_presence table
ALTER PUBLICATION supabase_realtime ADD TABLE user_presence;

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_user_presence_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_user_presence_timestamp_trigger ON user_presence;
CREATE TRIGGER update_user_presence_timestamp_trigger
BEFORE UPDATE ON user_presence
FOR EACH ROW
EXECUTE FUNCTION update_user_presence_timestamp();

-- Create function to cleanup stale sessions (older than 60 seconds)
CREATE OR REPLACE FUNCTION cleanup_stale_presence_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_presence
  WHERE last_activity < NOW() - INTERVAL '60 seconds';
END;
$$ LANGUAGE plpgsql;
