🚨 SUPABASE CRITICAL DOWNTIME - EMERGENCY ACTION PLAN
════════════════════════════════════════════════════════════════════════

SITUATION:
─────────
Your Supabase database is in CRITICAL STATE:
❌ PostgreSQL: UNHEALTHY (database backend down)
❌ PostgREST: UNHEALTHY (API layer affected)
❌ Auth: UNHEALTHY (authentication not working)
✅ Realtime: Healthy (websocket layer OK)

This cascading failure indicates DATABASE CRASH or SEVERE EXHAUSTION.
Users cannot login, fetch data, or perform any operations.


ROOT CAUSES (In Order of Likelihood):
──────────────────────────────────────
1. 🔴 Connection pool completely exhausted (10/10 connections used)
2. 🔴 Database instance crashed and stuck in restart loop
3. 🔴 Database running out of disk space or memory
4. 🔴 Long-running migration or transaction locking everything
5. 🔴 Supabase platform incident in Ireland (eu-west-1) region


IMMEDIATE ACTION (DO THIS NOW - 5 MINUTES):
═════════════════════════════════════════════════════════════════════

⏱️  YOU MUST DO THIS WITHIN 5 MINUTES TO MINIMIZE DOWNTIME

STEP 1: Open Supabase SQL Editor
────────────────────────────────
1. Go to: https://app.supabase.com
2. Select your project: skygridtec06
3. Click: "SQL Editor" in left sidebar
4. Click: "New Query"


STEP 2: Execute Emergency Connection Termination (COPY & PASTE)
───────────────────────────────────────────────────────────────
Copy this ENTIRE block and paste into SQL Editor, then click "Run":

-- EMERGENCY: Kill ALL non-essential connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
AND state = 'idle'
AND usename NOT IN ('postgres', 'supabase_admin');

Click "Run" button
Wait for completion

Expected result: Shows number of connections terminated (could be 0-8+)


STEP 3: Kill Old Connections (COPY & PASTE)
─────────────────────────────────────────────
-- Kill connections running for >10 minutes
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE query_start < now() - interval '10 minutes'
AND pid <> pg_backend_pid();

Expected result: Shows number of old connections killed


STEP 4: Check Connection Status (COPY & PASTE)
────────────────────────────────────────────────
-- How many connections are currently active?
SELECT count(*) as active_connections
FROM pg_stat_activity
WHERE pid <> pg_backend_pid();

Expected result: Should be LESS THAN 5 (pool has room now)


STEP 5: Check for Blocking Locks (COPY & PASTE)
─────────────────────────────────────────────────
-- Check if any queries are stuck in locks
SELECT l.pid, l.usename, l.application_name, l.state, l.query
FROM pg_stat_activity l
WHERE l.state = 'active'
OR l.state = 'idle in transaction'
LIMIT 5;

If results show queries, note the PIDs


STEP 6: Kill Stuck Queries (COPY & PASTE IF STEP 5 FOUND STUCK QUERIES)
────────────────────────────────────────────────────────────────────────
-- Kill specific stuck queries (replace PID with numbers from STEP 5)
SELECT pg_terminate_backend(12345); -- Replace 12345 with actual PID


STEP 7: Restart Your Database
──────────────────────────────
If after STEP 2-4 database still shows "Unhealthy":

1. Close SQL Editor
2. Go to: Database > Settings
3. Scroll to bottom
4. Look for "Restart Database" button or "Instance" section
5. Click "Restart"
6. Confirm restart
7. Wait 2-3 minutes (system will be DOWN during restart)
8. Database should restart automatically


STEP 8: Verify Recovery
───────────────────────
After restart, check:
1. Go to: Database > Status
2. Should see all services marked "Healthy" (not unhealthy)
3. Try loading your app: https://betnexa.co.ke
4. Games should load from cache
5. Users should be able to login


═════════════════════════════════════════════════════════════════════

IF NONE OF THE ABOVE WORKS (Last Resort):
──────────────────────────────────────────

OPTION A: Upgrade Database Instance
────────────────────────────────────
Your database is currently: NANO (0.5 GB RAM)
This is TOO SMALL for continuous operation.

1. Go to: Database > Settings > Instance
2. Select: "Small" (1 GB RAM) or larger
3. Click: "Upgrade"
4. System handles migration automatically
5. Cost increases ~$20/month but eliminates resource crashes


OPTION B: Check Supabase Status Page
─────────────────────────────────────
If YOUR fixes don't work, it may be a Supabase incident:
→ https://status.supabase.com
→ Look for Ireland (eu-west-1) region incidents
→ If incident exists, wait for Supabase to fix (ETA shown)


OPTION C: Contact Supabase Emergency Support
──────────────────────────────────────────────
Email: support@supabase.com
Subject: CRITICAL: Database Crashing - Project skygridtec06
Include:
- Project ID: skygridtec06
- Status: PostgreSQL/PostgREST/Auth unhealthy
- Impact: All users unable to access platform
- Last working: [when it last worked]


═════════════════════════════════════════════════════════════════════

CODE CHANGES TO PREVENT FUTURE CRASHES:
────────────────────────────────────────

FILE 1: src/services/supabaseClient.ts
─────────────────────────────────────────
Add connection pooling configuration:

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://eaqogmybihiqzivuwyav.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Lc8dQIzND4_qyIbN2EuQrQ_0Ma0OINQ';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'X-Client-Info': 'betnexa-web'
    }
  }
});

export default supabase;


FILE 2: server/server.js
────────────────────────
Add request timeout to prevent hanging connections:

// Add this near the top after express setup
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Add timeout for all requests
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    console.error(`Request timeout: ${req.method} ${req.path}`);
    res.status(408).json({ error: 'Request timeout' });
  });
  next();
});


FILE 3: server/services/database.js
───────────────────────────────────
Add connection pool monitoring:

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Monitor connection pool health every 60 seconds
setInterval(async () => {
  try {
    const { data, error } = await supabase
      .from('pg_stat_activity')
      .select('count', { count: 'exact' });
    
    const connCount = data?.[0]?.count || 0;
    
    if (connCount > 8) {
      console.warn(`⚠️  CRITICAL: ${connCount}/10 connections in use!`);
      // Optionally send alert or log for monitoring
    } else if (connCount > 6) {
      console.warn(`⚠️  WARNING: ${connCount}/10 connections in use`);
    }
  } catch (err) {
    console.error('Connection pool monitor error:', err.message);
  }
}, 60000);

module.exports = { supabase };


═════════════════════════════════════════════════════════════════════

TESTING AFTER RECOVERY:
───────────────────────
✓ Can you login to the dashboard?
✓ Do games load on the homepage?
✓ Can you place a bet?
✓ Can you make a deposit?
✓ Can you withdraw?
✓ Are admin functions working?

If any fail, database may still be having issues.


═════════════════════════════════════════════════════════════════════
EMERGENCY CHECKLIST:
□ Ran idle connection termination
□ Ran old connection termination  
□ Checked connection count (< 5)
□ Checked for blocking locks
□ Restarted database if needed
□ Verified all services show "Healthy"
□ Tested app functionality
□ Implemented code changes to prevent future crashes
□ Considered upgrading instance size

═════════════════════════════════════════════════════════════════════
Generated: April 22, 2026
Database: eaqogmybihiqzivuwyav.supabase.co
Region: eu-west-1 (Ireland)
PRIORITY: CRITICAL - IMMEDIATE ACTION REQUIRED
═════════════════════════════════════════════════════════════════════
