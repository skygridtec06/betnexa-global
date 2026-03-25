# Match Event Scheduler - Complete Implementation Guide

## Overview

The Match Event Scheduler is an automated system that allows admins to pre-configure match events and have them execute automatically at scheduled times without manual intervention.

**User Flow:**
1. Admin creates a match in Admin Panel
2. Admin navigates to **"Match Events"** tab
3. Admin adds events (kickoff, halftime, resume, score updates, end)
4. Admin sets match status to **"live"**
5. System automatically executes each event at its scheduled time
6. Bets automatically settle after score updates
7. Users see live updates without any manual admin intervention

---

## System Architecture

### Database
**Table: `match_events`**
```sql
- id (UUID, PK)
- game_id (UUID, FK to games)
- event_type ('kickoff'|'halftime'|'resume'|'score_update'|'end')
- scheduled_at (TIMESTAMP, when event should trigger)
- executed_at (TIMESTAMP, actual execution time)
- event_data (JSONB, event-specific config)
- is_active (BOOLEAN, disable/enable events)
- created_at, updated_at (timestamps)
```

### Backend Services

#### 1. **matchEventService.js** (`server/services/matchEventService.js`)
Core service with functions:
- `createMatchEvents(gameId, events)` - Create events
- `getPendingEvents(gameId)` - Get events ready to execute
- `executeEvent(event, gameId)` - Execute single event
- `checkAndExecutePendingEvents(gameId)` - Check and execute all pending events
- `getMatchEvents(gameId)` - List all events for a game
- `deleteMatchEvent(eventId)` - Delete event
- `updateMatchEvent(eventId, updates)` - Update event

#### 2. **matchScheduler.js** (`server/services/matchScheduler.js`)
Background scheduler:
- `startMatchEventScheduler(intervalMs)` - Start scheduler (checks every 5 seconds by default)
- `stopMatchEventScheduler()` - Stop scheduler
- `isSchedulerActive()` - Check if running
- `executePendingEventsManually(gameId)` - Manual trigger

**How it works:**
- Runs periodically (default: 5000ms / 5 seconds)
- Fetches all live games from DB
- For each live game, calls `checkAndExecutePendingEvents(gameId)`
- Compares current server time against `scheduled_at` timestamps
- Executes events whose time has arrived
- Marks events as `executed_at = NOW()`

#### 3. **Admin Routes** (`server/routes/admin.routes.js`)
New API endpoints:

```
POST   /api/admin/match-events
       Create events for a game
       Body: { gameId, events: [{eventType, scheduledAt, eventData}, ...] }

GET    /api/admin/match-events/:gameId
       List all events for a game

PUT    /api/admin/match-events/:eventId
       Update event timing/data
       Body: { scheduled_at, event_data, is_active }

DELETE /api/admin/match-events/:eventId
       Delete an event

POST   /api/admin/match-events/:gameId/execute-pending
       Manually trigger execution of pending events
```

### Frontend Components

#### **MatchEventEditor.tsx** (`src/components/MatchEventEditor.tsx`)
React component for event configuration:
- Display existing events
- Add new events dialog with:
  - Event type selector
  - Time offset (minutes after kickoff)
  - Score details for score updates (minute, home score, away score)
- Show event status: Pending, Executed, Inactive
- Delete events (only if not yet executed)

#### **AdminPortal.tsx** Updates
- Added "Match Events" tab (Calendar icon)
- Game selector to choose which match to configure
- Embedded MatchEventEditor component

---

## Event Types and Execution

### 1. **Kickoff Event**
- Sets match to **LIVE** status
- Sets `is_kickoff_started = true`
- Records `kickoff_start_time` if not already set
- Timer starts counting from 0:00

### 2. **Halftime Event**
- Sets `is_halftime = true`
- Pauses the game: `game_paused = true`
- Sets minute to 45 (or keeps current minute if already higher)
- Records pause time for resuming

### 3. **Resume Event**
- Clears halftime: `is_halftime = false`
- Unpauses: `game_paused = false`
- Recalculates `kickoff_start_time` so timer shows 45+ minutes
- Sets minute to 45

### 4. **Score Update Event**
- Updates `home_score` and `away_score`
- Updates `minute`
- **Triggers automatic bet settlement** (evaluates all bet selections)
- Users see live score update in real-time

### 5. **End Event**
- Sets status to **FINISHED**
- Unpauses game
- Clears halftime flag
- **Triggers final bet settlement**

---

## Example Usage

### Scenario: Liverpool vs Manchester United, Tomorrow 22:00 UTC

**Admin Configuration (Tomorrow at 12:00 UTC):**

1. Go to **Admin Panel > Match Events**
2. Select match: "Liverpool vs Manchester United"
3. Add Event #1:
   - Type: **Kickoff**
   - Time: **+0 minutes** (22:00 UTC exactly)

4. Add Event #2:
   - Type: **Score Update**
   - Time: **+10 minutes** (22:10 UTC)
   - Data: Minute=10, Home=1, Away=0

5. Add Event #3:
   - Type: **Halftime**
   - Time: **+46 minutes** (22:46 UTC)

6. Add Event #4:
   - Type: **Resume**
   - Time: **+51 minutes** (22:51 UTC, after halftime break)

7. Add Event #5:
   - Type: **Score Update**
   - Time: **+69 minutes** (23:09 UTC)
   - Data: Minute=69, Home=1, Away=1

8. Add Event #6:
   - Type: **End**
   - Time: **+98 minutes** (23:38 UTC)

9. Set match status to **LIVE**

**Automatic Execution (When Clock Hits Times):**
- 22:00 UTC: ✅ Match goes LIVE, timer shows 0:00
- 22:10 UTC: ✅ Score updates to 1-0, bets on "Over 0.5" settle as WON
- 22:46 UTC: ✅ Halftime, timer pauses at 45:00
- 22:51 UTC: ✅ 2nd half starts, timer continues from 45:00
- 23:09 UTC: ✅ Score updates to 1-1, bets settle (e.g., "Under 2.5" still pending)
- 23:38 UTC: ✅ Match ends with final score 1-1, all bets settle

**All without admin manually clicking anything!**

---

## Database Schema Deployment

Ensure the `match_events` table exists in Supabase:

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

---

## Integration with Existing Systems

### Bet Settlement
When a **score_update** or **end** event executes:
1. Game scores are updated
2. The existing `settleBetsForGame(gameId)` function is automatically called
3. All bet selections are evaluated against the updated score
4. Winning bets get credited to user balance
5. Users see real-time bet status updates

### Match Timer
- Uses existing `gameTimeCalculator.ts` logic
- Calculates elapsed time based on `kickoff_start_time`
- During resume event, `kickoff_start_time` is recalculated to maintain correct minute display
- Formula: `elapsedMs = now - kickoff_start_time`, then `minute = elapsedMs / 60000`

### Admin Endpoints
- Still support manual score updates via `PUT /api/admin/games/:gameId/score`
- Scheduler works alongside manual controls
- If manual update conflicts with scheduled event, both execute independently

---

## Monitoring & Debugging

### Server Logs
The scheduler logs all activity:
```
📅 Creating 5 automated events for game abc123
✅ Created 5 match events
⚡ Executing event: kickoff for game abc123
✅ Event kickoff executed successfully
⚽ Executing SCORE UPDATE event
📊 Triggering bet settlement for game abc123
```

### Check Events for a Game
```bash
curl -X GET "http://localhost:5000/api/admin/match-events/GAME_ID" \
  -H "Content-Type: application/json" \
  -d '{"phone":"0712345678"}'
```

### Manual Trigger
```bash
curl -X POST "http://localhost:5000/api/admin/match-events/GAME_ID/execute-pending" \
  -H "Content-Type: application/json" \
  -d '{"phone":"0712345678"}'
```

---

## Best Practices

✅ **DO:**
- Pre-configure events well before match kickoff
- Use realistic score progression (e.g., don't jump from 0-0 to 5-5)
- Set kickoff event to match exact kickoff time
- Add halftime at 45 minutes, resume at 46+ minutes
- Test with a demo match first before scheduling live matches

❌ **DON'T:**
- Set event times that are in the past
- Overlap events of the same type (system will execute both)
- Manually update scores while scheduler is running (may cause conflicts)
- Set unrealistic minute values (e.g., minute > 120 before end)

---

## Timezone Handling

All times are stored in UTC in the database:
- `scheduled_at`: Stored as UTC TIMESTAMP
- Conversion to EAT (East Africa Time) happens in frontend display
- When admin sets "10 minutes after kickoff", it's converted to absolute UTC timestamp
- Formula: `scheduled_at = kickoff_time_utc + (offset_minutes * 60 seconds)`

---

## Future Enhancements

Potential improvements:
1. **Event Templates**: Pre-built scenarios (e.g., "competitive match", "one-sided match")
2. **Event Validation**: Warn if times are unrealistic
3. **Batch Operations**: Schedule multiple matches at once
4. **Edit Running Events**: Modify pending events even after match starts
5. **Event History**: Archive executed events for audit trail
6. **Conditional Events**: Execute event only if previous score was X
7. **Event Notifications**: Send SMS/push when events execute

---

## Support & Troubleshooting

**Q: Events not executing?**
- Check if match status is "live" (scheduler only processes live games)
- Verify server time is correct (UTC-based)
- Check server logs for errors
- Manually trigger with `/api/admin/match-events/:gameId/execute-pending`

**Q: Events executed too early/late?**
- Verify UTC timezone on server
- Check that `scheduled_at` timestamps are correct in database

**Q: Bet settlement not triggering?**
- Ensure `settleBetsForGame()` is available in codebase
- Check bet context is properly initialized on frontend

**Q: How to cancel a match?**
- Delete all pending events for that match
- Or set `is_active = false` for individual events

---

## Summary

The Match Event Scheduler system enables fully automated match management:
- ✅ Pre-configure entire match timeline in admin panel
- ✅ All events execute automatically at scheduled times
- ✅ Bets settle automatically after score updates
- ✅ Zero manual intervention required once match goes live
- ✅ Perfect for demo matches and testing scenarios
- ✅ Can coexist with manual admin controls

**Start using it today to automate your match management!**
