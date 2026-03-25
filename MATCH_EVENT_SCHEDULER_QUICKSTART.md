# ⚙️ Match Event Scheduler - Quick Start

## What's New? 🎯

You now have a **fully automated match event scheduler** that lets you pre-configure entire match timelines and have them execute automatically without manual intervention.

**Example:** Set everything up at noon, and when the match goes live at 22:00, the entire event sequence runs automatically with zero clicks.

---

## Quick Setup (5 minutes)

### 1️⃣ Deploy Database
Run this SQL in Supabase:
```sql
CREATE TABLE IF NOT EXISTS match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('kickoff', 'halftime', 'resume', 'score_update', 'end')),
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE,
  event_data JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(game_id, event_type, scheduled_at)
);

CREATE INDEX idx_match_events_game_id ON match_events(game_id);
CREATE INDEX idx_match_events_scheduled_at ON match_events(scheduled_at);
CREATE INDEX idx_match_events_executed_at ON match_events(executed_at);
```

### 2️⃣ Deploy Backend & Frontend
```bash
git add .
git commit -m "feat: Add match event scheduler"
git push
# Deploy normally (Vercel / your hosting)
```

### 3️⃣ Verify It Works
Check server logs for: `✅ Starting Match Event Scheduler (checking every 5000ms)`

---

## How to Use

### Step 1: Create a Match
Go to **Admin Panel → Games tab** → Add a fixture normally

### Step 2: Configure Events
1. Click **Admin Panel → Match Events tab**
2. Select your match from the list
3. Click **+ Add Event** for each automated event

**Add These Events:**
| Event | When | Details |
|-------|------|---------|
| Kickoff | 0 min | Starts the match |
| Score | 10 min | Home 1-0 |
| Halftime | 46 min | Pause at 45' |
| Resume | 51 min | Start 2nd half |
| Score | 69 min | Home 1-1 |
| End | 98 min | Match finished |

### Step 3: Go Live
- Set match status to **LIVE**
- Events will execute automatically at their scheduled times

---

## Files Created/Modified

### ✨ New Files
```
server/services/matchEventService.js      (event execution engine)
server/services/matchScheduler.js         (background scheduler)
src/components/MatchEventEditor.tsx       (event configuration UI)
MATCH_EVENT_SCHEDULER_GUIDE.md            (full documentation)
MATCH_EVENT_SCHEDULER_DEPLOYMENT.md       (deployment checklist)
```

### 📝 Modified Files
```
server/server.js                          (initialize scheduler)
server/routes/admin.routes.js             (5 new API endpoints)
src/pages/AdminPortal.tsx                 (new Events tab)
supabase-schema.sql                       (match_events table)
```

---

## What Happens Automatically

✅ Events execute at their scheduled times  
✅ Halftime pauses the match  
✅ Resume continues from 45:00  
✅ Bets settle after score updates  
✅ Users see live updates in real-time  
✅ Match ends and final bets settle  

**All without you clicking anything!**

---

## Example Timeline

**Tomorrow 22:00 UTC - Liverpool vs Manchester United**

**Admin Setup (Today, 12:00 UTC):**
1. Create match for tomorrow at 22:00
2. Go to Match Events
3. Add 6 events with times
4. Save
5. **That's it!**

**Automatic Execution (Tomorrow):**
```
22:00 UTC → ✅ Kickoff - match LIVE, timer 0:00
22:10 UTC → ✅ Score - 1-0, bets settle
22:46 UTC → ✅ Halftime - timer pauses at 45:00
22:51 UTC → ✅ Resume - timer continues from 45:00
23:09 UTC → ✅ Score - 1-1, bets settle
23:38 UTC → ✅ End - match FINISHED, final settlement
```

---

## API Endpoints

**For Advanced Users:**

```bash
# Create events
POST /api/admin/match-events
{ "gameId": "uuid", "events": [...] }

# List events
GET /api/admin/match-events/:gameId

# Update event
PUT /api/admin/match-events/:eventId
{ "scheduled_at": "...", "event_data": {...} }

# Delete event
DELETE /api/admin/match-events/:eventId

# Manual trigger
POST /api/admin/match-events/:gameId/execute-pending
```

---

## Troubleshooting

**Q: Scheduler not starting?**  
A: Check server logs, restart server

**Q: Events not executing?**  
A: Verify match status is LIVE, check server time is UTC

**Q: Events tab doesn't appear?**  
A: Hard refresh browser (Ctrl+Shift+R)

**Q: Bets not settling?**  
A: Check settlement logic in codebase is working

---

## Key Features

| Feature | Details |
|---------|---------|
| 🎯 **Auto Kickoff** | Match becomes LIVE automatically |
| ⏱️ **Halftime Control** | Pause and resume built-in |
| ⚽ **Live Scores** | Update scores at specific match minutes |
| 💰 **Auto Settlement** | Bets settle when scores change |
| 📅 **Pre-configure** | Set everything before match starts |
| 🔄 **No Manual Clicks** | Runs 100% automatically once LIVE |
| 🛠️ **Admin Panel UI** | Easy event configuration |
| ✏️ **Edit/Delete** | Modify events before execution |
| 📊 **Event History** | See all executed events |

---

## Next Steps

1. ✅ Deploy the code
2. ✅ Run the database migration
3. ✅ Test with a demo match
4. ✅ Configure a real match
5. ✅ Watch it auto-execute perfectly!

---

## Support Materials

- **Full Guide:** [`MATCH_EVENT_SCHEDULER_GUIDE.md`](MATCH_EVENT_SCHEDULER_GUIDE.md)
- **Deployment:** [`MATCH_EVENT_SCHEDULER_DEPLOYMENT.md`](MATCH_EVENT_SCHEDULER_DEPLOYMENT.md)
- **Code:** Check individual service files for implementation details

---

## Architecture Overview

```
Admin UI (MatchEventEditor)
         ↓
Admin APIs (/api/admin/match-events)
         ↓
matchEventService (execute events)
         ↓
matchScheduler (run every 5 seconds)
         ↓
Database (match_events table)
         ↓
Game State Updates → Bet Settlement → User Notifications
```

---

## Performance

- ⚡ Scheduler runs every 5 seconds
- ⚡ Only processes LIVE games
- ⚡ Events execute in serial (no concurrency issues)
- ⚡ Minimal database load
- ⚡ Zero impact on other admin functions

---

## Security

- 🔐 Admin authentication required
- 🔐 Events tied to specific games
- 🔐 Executed events are immutable
- 🔐 All changes logged in database

---

**🚀 You're all set! Start automating your matches now.**

Questions? Check the full guide or deployment checklist.
