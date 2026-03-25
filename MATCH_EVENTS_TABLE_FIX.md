# Fix: Add match_events Table to Production Database

**Issue Found:** The `match_events` table doesn't exist in the production Supabase database, causing the API to return: `"Could not find the table 'public.match_events'"`

## Solution: Run Migration on Supabase Console

### Step 1: Go to Supabase Dashboard
1. Open https://app.supabase.com
2. Select your BETNEXA project
3. Click on **SQL Editor** (left sidebar)

### Step 2: Create New Query
1. Click **New Query** button (top right)
2. Name it: `Create match_events table`
3. Delete any template content

### Step 3: Paste SQL Migration
Copy and paste the entire content of `migrations/create_match_events_table.sql`:

```sql
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
```

### Step 4: Execute Query
1. Click **RUN** button (bottom right of query editor)
2. You should see: `✅ Success. No rows returned.`

### Step 5: Verify Table Created
1. Go to **Database** menu (left sidebar)
2. Look under Tables section
3. You should see `match_events` table listed
4. Verify it has columns: `id`, `game_id`, `event_type`, `scheduled_at`, `executed_at`, `event_data`, `is_active`, `created_at`, `updated_at`

### Step 6: Test the API Again
1. Open Admin Portal at https://betnexa.vercel.app
2. Go to Games tab
3. Click **Automate** button (⚡ icon) on any match
4. Go to Events tab - should now show event list (or "No events configured yet")
5. Click **Add Event** button - should no longer show JSON parse error

## Troubleshooting

**If you get an error about `games` table not found:**
- The games table must exist first
- It should already exist, but if not, check `supabase-schema.sql` for the full schema

**If the query fails:**
- Copy the SQL to a new query and try again
- Check that your Supabase project is the correct one

**If the table exists but API still fails:**
- Try refreshing Supabase connection: Go to Database > Connection Pool > Refresh
- Wait 30 seconds and try the API again

---

**After this is done, the full event scheduling system should be operational!**
