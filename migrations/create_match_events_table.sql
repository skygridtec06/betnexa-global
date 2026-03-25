-- Create match_events table for automated event scheduling
CREATE TABLE IF NOT EXISTS match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'kickoff' | 'halftime' | 'resume' | 'score_update' | 'end'
  scheduled_at TIMESTAMP NOT NULL, -- When this event should trigger (UTC ISO)
  executed_at TIMESTAMP NULL, -- When event actually executed
  event_data JSONB, -- Event-specific data (e.g., {"homeScore": 1, "awayScore": 0} for score updates)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(game_id, event_type, scheduled_at)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_match_events_game_id ON match_events(game_id);
CREATE INDEX IF NOT EXISTS idx_match_events_scheduled_at ON match_events(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_match_events_executed_at ON match_events(executed_at);
CREATE INDEX IF NOT EXISTS idx_match_events_is_active_pending ON match_events(is_active, executed_at) WHERE executed_at IS NULL;

-- Note: RLS is managed at the backend via checkAdmin middleware
-- The backend validates admin status and only processes requests from authenticated admin users
