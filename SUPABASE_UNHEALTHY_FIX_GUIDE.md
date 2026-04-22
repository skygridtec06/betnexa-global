📋 SUPABASE DATABASE "UNHEALTHY" FIX GUIDE
═════════════════════════════════════════════════════════════════

🔍 DIAGNOSIS RESULTS:
─────────────────────────────────────────────────────────────────
✅ API Layer: REACHABLE (HTTP 401)
❌ Database Layer: NOT RESPONDING (Query Timeout)
❌ Status: UNHEALTHY

ROOT CAUSE:
The Supabase API is responding, but the PostgreSQL database backend is
not responding to queries. This is typically caused by:

1. ⭐ CONNECTION POOL EXHAUSTION (Most Common)
   - Too many idle connections consuming pool slots
   - Application not properly closing connections
   - Default pool size (10) exhausted

2. ⭐ DATABASE RESOURCE EXHAUSTION
   - 100% CPU usage on database instance
   - Low available memory
   - Disk space full or nearly full
   - High I/O wait times

3. ⭐ DATABASE LOCK/DEADLOCK
   - Long-running transaction holding locks
   - Table-level locks from migrations
   - Deadlock situation between concurrent queries

4. SUPABASE SERVICE INCIDENT
   - Check https://status.supabase.com
   - Ireland (eu-west-1) region issues


🛠️  STEP-BY-STEP FIX (DO THIS NOW):
─────────────────────────────────────────────────────────────────

STEP 1: Check Supabase Dashboard Status
────────────────────────────────────────
1. Go to: https://app.supabase.com
2. Select your project: skygridtec06
3. Navigate to: Database > Status
4. Look for:
   ✓ Resource usage (CPU %, Memory, Disk %)
   ✓ Active connections count
   ✓ Any error messages or alerts
5. Check: https://status.supabase.com for incidents


STEP 2: Kill Idle Connections (Quick Fix)
──────────────────────────────────────────
1. Go to Supabase Dashboard
2. Open SQL Editor
3. Run this command:

SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND query_start < now() - interval '10 minutes';

This kills idle connections older than 10 minutes.


STEP 3: Check for Table Locks
──────────────────────────────
1. In SQL Editor, run:

SELECT 
  l.locktype,
  l.pid,
  l.mode,
  l.granted,
  t.relname,
  a.usename,
  a.query,
  a.state
FROM pg_locks l
JOIN pg_class t ON l.relation = t.oid
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE NOT l.granted;

If results show locks, identify and kill blocking PIDs:

SELECT pg_terminate_backend(pid) 
WHERE pid = <PID_FROM_ABOVE>;


STEP 4: Verify Connection Settings
───────────────────────────────────
1. Database > Connection Pooling
2. Check:
   ✓ Pool mode: "Transaction" recommended
   ✓ Pool size: Should be 10-20 (not exhausted)
   ✓ Max idle: Should be < 300 seconds

3. If pool is misconfigured:
   - Reduce pool size temporarily
   - Switch to "Transaction" mode
   - Increase max idle timeout


STEP 5: Check Recent Changes
────────────────────────────
Ask yourself:
✓ Did you run any migrations recently?
✓ Did you create/drop any large indexes?
✓ Did query patterns change (batch operations)?
✓ Did you increase application concurrency?
✓ Are there any scheduled jobs running?

If yes, those could be causing locks or resource usage.


STEP 6: Restart Database (Nuclear Option)
─────────────────────────────────────────
If other steps don't work:

1. Go to: Database > Settings
2. Look for "Restart Database" button
3. Click and confirm
4. Wait 2-3 minutes for restart
5. Test connectivity again


STEP 7: Upgrade Database Instance (If Needed)
──────────────────────────────────────────────
If resource usage is consistently high:

1. Database > Settings > Instance Size
2. Upgrade from:
   - nano (0.5GB RAM) → small (1GB RAM)
   - small → medium (2GB RAM)
3. Click Upgrade
4. System will handle migration automatically


🔧 CODE-LEVEL FIXES (For Your Application):
─────────────────────────────────────────────

1. Enable Connection Pooling in Frontend
─────────────────────────────────────────
File: src/services/supabaseClient.ts

Current (may be exhausting pool):
const supabase = createClient(supabaseUrl, supabaseKey);
export default supabase;

Better (with connection pooling awareness):
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  },
  db: {
    schema: 'public'
  }
});

export default supabase;


2. Add Request Timeout Handling in Backend
───────────────────────────────────────────
File: server/server.js or any route that queries DB

Add timeout wrapper:

async function executeWithTimeout(query, timeoutMs = 5000) {
  return Promise.race([
    query,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Database query timeout')),
        timeoutMs
      )
    )
  ]);
}

Usage:
try {
  const { data, error } = await executeWithTimeout(
    supabase.from('users').select(),
    5000
  );
} catch (err) {
  if (err.message.includes('timeout')) {
    console.error('Database timeout - pool might be exhausted');
    // Fallback or retry logic
  }
}


3. Add Connection Pool Monitoring
──────────────────────────────────
File: server/services/dbMonitor.js (create new)

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function monitorConnections() {
  const { data, error } = await supabase
    .from('pg_stat_activity')
    .select('count', { count: 'exact' });

  if (!error) {
    console.log(`Active connections: ${data.length}`);
    if (data.length > 8) {
      console.warn('⚠️  Connection pool near capacity!');
    }
  }
}

// Run every 30 seconds
setInterval(monitorConnections, 30000);


4. Implement Proper Connection Cleanup
───────────────────────────────────────
In any async operations, ensure connections are closed:

// ❌ Bad - connection may stay open
async function fetchUsers() {
  const { data } = await supabase.from('users').select();
  return data;
}

// ✅ Good - explicit cleanup
async function fetchUsers() {
  try {
    const { data } = await supabase.from('users').select();
    return data;
  } finally {
    // Supabase client auto-cleans, but be explicit
  }
}


📊 MONITORING DASHBOARD URLS:
─────────────────────────────────────────────────────────────────
📍 Project Dashboard: https://app.supabase.com
📍 Project Logs: https://app.supabase.com/project/YOUR_PROJECT/logs/postgres
📍 Status Page: https://status.supabase.com
📍 Billing: https://app.supabase.com/account/billing


📞 WHEN TO CONTACT SUPPORT:
─────────────────────────────────────────────────────────────────
If after all above steps:
1. Database still shows "Unhealthy"
2. Connection pool is not exhausted
3. No table locks found
4. Resources are not maxed out
5. No service incidents on status page

Contact: support@supabase.com
Include:
- Project ID: skygridtec06
- Error messages from logs
- Connection pool status
- Recent changes/migrations


✅ VERIFICATION CHECKLIST:
─────────────────────────────────────────────────────────────────
After implementing fixes, verify:

□ Supabase Dashboard shows "Healthy"
□ Database queries complete within 5 seconds
□ Frontend loads games without timeout
□ Admin API responds to requests
□ No connection errors in logs
□ Connection count stays below 8/10 pool size
□ CPU usage < 80%
□ Memory usage < 80%
□ No table locks present


═════════════════════════════════════════════════════════════════
Generated: April 22, 2026
Database: eaqogmybihiqzivuwyav.supabase.co
Project: skygridtec06
═════════════════════════════════════════════════════════════════
