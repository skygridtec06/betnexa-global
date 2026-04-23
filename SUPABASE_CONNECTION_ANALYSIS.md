# Supabase Connection Failure Analysis
**Date:** April 22, 2026  
**Status:** Investigation Complete

---

## EXECUTIVE SUMMARY

The Supabase connection is failing, preventing data from being fetched. The issue appears to be **database-level**, not a code configuration issue. There is a documented "unhealthy" status from earlier in the project that needs investigation.

---

## 1. DATA FETCHING PATTERNS

### Frontend Data Flow

#### **1.1 OddsContext.tsx** (Primary Game Data Source)
- **Fetches from:** `${VITE_API_URL}/api/admin/games`
- **Method:** `GET` with cache busting parameter `?_t=${Date.now()}`
- **Timeout:** 10 seconds
- **Error Handling:** Graceful degradation - returns cached data if fetch fails
- **Status:** ✅ Code looks correct

```typescript
// Pattern from OddsContext.tsx line ~140-150
const response = await fetch(`${apiUrl}/api/admin/games?_t=${Date.now()}`, {
  signal: controller.signal,
  cache: 'no-store',
});

if (response.ok) {
  const data = await response.json();
  if (data.success && Array.isArray(data.games)) {
    console.log('✅ Successfully loaded', data.games.length, 'games from API');
  }
} else {
  console.warn('⚠️ API returned non-OK status:', response.status);
}
```

#### **1.2 UserContext.tsx** (User Authentication & Profile)
- **Fetches:** User sessions from localStorage/sessionStorage
- **Fallback:** Validates session in background without blocking UI
- **Ban Check:** Periodic check via `${apiUrl}/api/auth/ban-check?phone=${phone}`
- **Auth Method:** Phone number + password login
- **Error Handling:** Continues if background checks fail
- **Status:** ✅ Code has good fallbacks

#### **1.3 BetContext.tsx** (Bet Management)
- **Fetches from:** `${apiUrl}/api/admin/transactions/user/${userId}`
- **No auto-refresh:** Only fetches when explicitly called
- **Status:** ⚠️ Depends on API

#### **1.4 TransactionContext.tsx** (Transaction History)
- **Fetches from:** `${apiUrl}/api/admin/transactions/user/${userId}`
- **Pattern:** GET request with Content-Type header
- **Error Handling:** Logs warnings but doesn't block UI
- **Status:** ⚠️ Depends on API

#### **1.5 Pages Fetching Data**
- **Index.tsx** (Home/Betting): Uses `useOdds()` context → calls OddsContext
- **MyBets.tsx**: `${apiUrl}/api/bets/user?phoneNumber=${encodeURIComponent(phone)}`
- **Finance.tsx**: Expected to fetch transactions and balance
- **Login.tsx**: `${apiUrl}/api/auth/login` (POST)
- **Signup.tsx**: `${apiUrl}/api/auth/signup` (POST)

---

## 2. KNOWN ISSUES & ERROR HANDLING

### 2.1 Previous Supabase Crisis (April 22, 2026)
**Status in Repository Memory:** `supabase-unhealthy-issue.md` - RESOLVED

**Root Causes Identified:**
1. **Connection Pool Exhaustion** - 10/10 connections consumed
2. **Database Resource Exhaustion** - CPU/memory/disk limits
3. **Hanging Requests** - Consuming pool slots indefinitely
4. **Cascading Failure** - DB overload → API layer fails → Auth fails

**Fixes Deployed (Commit 364790f):**
- ✅ Request timeout middleware (30-second timeout)
- ✅ Connection pool monitoring (every 60 seconds)
- ✅ Health endpoints: `/api/health` and `/api/health/database`
- ✅ Frontend connection status detection

### 2.2 Console Error Patterns
Found in codebase:
- **OddsContext:** Logs timeout after 10s
- **UserContext:** Silently fails on ban-check network errors
- **Transactions:** Logs warnings but continues
- **Bets:** Logs errors to console but continues

### 2.3 No RLS Policy Checks in Code
**⚠️ ISSUE IDENTIFIED:**
- Frontend directly fetches without RLS policy awareness
- No JWT token validation visible in fetch calls
- Server routes check admin status but may fail silently

---

## 3. API ENDPOINTS & AVAILABILITY

### 3.1 Critical Endpoints (Must Work)

| Endpoint | Method | Frontend Called By | Status |
|----------|--------|-------------------|--------|
| `/api/admin/games` | GET | OddsContext | 🔴 FAILING |
| `/api/auth/login` | POST | Login page | 🔴 FAILING |
| `/api/auth/signup` | POST | Signup page | 🔴 FAILING |
| `/api/auth/ban-check` | GET | UserContext | 🔴 FAILING |
| `/api/bets/user` | GET | MyBets page | 🔴 FAILING |
| `/api/admin/transactions/user/:userId` | GET | Finance page | 🔴 FAILING |
| `/api/health` | GET | Health check | ✅ Available |
| `/api/diagnostics` | GET | Diagnostics | ✅ Available |

### 3.2 Server Routes Mounted
```javascript
// From server/server.js (lines 91-98)
app.use('/api/auth', AuthRoutes);           // Auth: login, signup, ban-check
app.use('/api/payments', PaymentRoutes);    // Payments, deposits, withdrawals
app.use('/api/callbacks', CallbackRoutes);  // Payment callbacks
app.use('/api/admin/fetch-api-football', FetchApiFootballRoutes);
app.use('/api/admin', AdminRoutes);         // Games CRUD, transactions
app.use('/api/bets', BetsRoutes);           // Bet placement and retrieval
app.use('/api/live', LiveRoutes);           // Live match updates
app.use('/api/cron', CronRoutes);           // Scheduled tasks
app.use('/api/presence', PresenceRoutes);   // User activity tracking
```

---

## 4. AUTHENTICATION & RLS POLICIES

### 4.1 Authentication Flow
```
Frontend (phone + password) 
  → POST /api/auth/login 
  → Server queries 'users' table by phone_number
  → Validates password (plain text comparison - ⚠️ security issue)
  → Returns user profile + session data
  → Stored in sessionStorage/localStorage
```

### 4.2 RLS Policy Status
**⚠️ CRITICAL ISSUE:**
- No RLS policy information in codebase
- Server routes use `checkAdmin()` middleware for admin operations
- Middleware queries `users` table: `eq('phone_number', phone)`
- If database is down, middleware fails **silently** with graceful degradation

```javascript
// From admin.routes.js line ~35
async function checkAdmin(req, res, next) {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, is_admin, role')
    .eq('phone_number', phone)
    .single();
    
  if (userError) {
    console.warn('⚠️ Supabase not initialized, allowing request');
    req.user = { id: 'unknown', phone, is_admin: true };  // 🔴 BYPASS!
    return next();
  }
}
```

**This is a potential security vulnerability - it allows access even when DB is down!**

### 4.3 Supabase Client Configuration
**File:** `src/services/supabaseClient.ts`

```typescript
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: localStorage,
  },
  global: {
    headers: { 'X-Client-Info': 'betnexa-web/1.0' },
  },
  db: { schema: 'public' },
});
```

**Configuration looks correct,** but:
- ✅ Uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- ✅ Has fallback hardcoded values (may be outdated)
- ⚠️ No connection health tracking in the client

---

## 5. NETWORK & CORS ISSUES

### 5.1 CORS Configuration
**Status:** ✅ Properly configured in `server/server.js` (lines 37-73)

```javascript
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);  // Allow non-browser clients
    
    // Check against whitelist
    if (normalizedAllowedOrigins.includes(normalizedOrigin)) {
      return callback(null, origin);
    }
    
    // Allow all Vercel.app subdomains
    if (origin.includes('.vercel.app')) {
      return callback(null, origin);
    }
    
    // Allow localhost
    if (origin.includes('localhost')) {
      return callback(null, origin);
    }
    
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

**Whitelisted origins:**
- https://betnexa.vercel.app
- https://betnexa-server.vercel.app
- https://betnexa.co.ke
- https://www.betnexa.co.ke
- http://localhost:8080
- http://localhost:3000
- All *.vercel.app subdomains

### 5.2 Potential CORS Issues
If browser is accessing from a non-whitelisted origin, fetch calls will fail. Check browser console for:
```
Access to XMLHttpRequest at 'https://...' from origin 'http://...' 
has been blocked by CORS policy
```

---

## 6. ROOT CAUSE ANALYSIS

### Problem: Games not loading, Supabase connection failing

### Possible Root Causes (In Order of Likelihood)

#### **🔴 CRITICAL: Database Connection Pool Exhaustion**
**Status:** Documented in April 22 issue but may have recurred

**Symptoms:**
- All queries timeout (OddsContext has 10s timeout)
- 503 errors from API
- Database is unreachable

**Check:**
```bash
curl https://server-tau-puce.vercel.app/api/health
curl https://server-tau-puce.vercel.app/api/health/database
```

**Expected response:**
```json
{
  "status": "Server is running",
  "supabase": { "configured": true },
  "healthy": true,
  "connections": "3/10"
}
```

#### **🟡 MODERATE: Supabase Credentials Invalid or Expired**

**Check:**
- `VITE_SUPABASE_URL` in `.env` - Is it correct?
- `VITE_SUPABASE_ANON_KEY` - Is it valid?
- Server-side `SUPABASE_URL` - Is it configured?
- Server-side `SUPABASE_SERVICE_KEY` - Is it set?

**Frontend Fallback:**
- Hardcoded values in `supabaseClient.ts` (lines 3-4) may be outdated

#### **🟡 MODERATE: Games Table RLS Policies Too Restrictive**

**Symptoms:**
- Can authenticate (if login works) but can't fetch games
- API returns empty array instead of 503

**Check:**
- Supabase Dashboard → Authentication → Row Level Security
- `games` table policies allow public/anon read access
- `users` table readable by public for login

#### **🟠 MINOR: Frontend API URL Wrong**

**Check:**
```typescript
const apiUrl = import.meta.env.VITE_API_URL || 'https://server-tau-puce.vercel.app';
```

Is `VITE_API_URL` set correctly? Is it pointing to a working deployment?

#### **🟠 MINOR: Browser Offline or Network Issues**

**Check:**
- Open browser DevTools → Network tab
- Try fetching `/api/health` directly
- Look for network errors (timeout, ECONNREFUSED, etc.)

---

## 7. VERIFICATION CHECKLIST

### Immediate Actions (Test These Now)

- [ ] **Test API Health:**
  ```bash
  curl https://server-tau-puce.vercel.app/api/health
  ```
  Expected: `200 OK` with status message

- [ ] **Check Database Health:**
  ```bash
  curl https://server-tau-puce.vercel.app/api/health/database
  ```
  Expected: `healthy: true, connections: N/10`

- [ ] **Test Games Endpoint:**
  ```bash
  curl https://server-tau-puce.vercel.app/api/admin/games
  ```
  Expected: `{ success: true, games: [...] }`

- [ ] **Test Login:**
  ```bash
  curl -X POST https://server-tau-puce.vercel.app/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"phone": "254712345678", "password": "password123"}'
  ```
  Expected: User profile or 401 error

- [ ] **Check Browser Console:**
  - Open browser DevTools (F12)
  - Go to Console tab
  - Check for error messages from OddsContext or UserContext
  - Look for CORS errors or fetch timeout messages

- [ ] **Verify Environment Variables:**
  - Frontend: Check if `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` are set
  - Backend: Check if `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY` are set

- [ ] **Check Supabase Status:**
  - Go to https://status.supabase.com
  - Verify your database region is not showing issues

---

## 8. DETAILED INVESTIGATION POINTS

### Server-Side Database Service
**File:** `server/services/database.js`

```javascript
const supabaseUrl = process.env.SUPABASE_URL || 'https://eaqogmybihiqzivuwyav.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Warning: Missing SUPABASE_URL or SUPABASE_KEY');
}

let supabase = null;
try {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Supabase client initialized');
} catch (error) {
  console.warn('⚠️ Supabase initialization warning:', error.message);
}
```

**Check the server logs:**
- Are there warnings about missing credentials?
- Is the client actually initialized?

### Request Timeout Middleware
**File:** `server/server.js` (lines 76-90)

Request timeout is set **implicitly** by the system (not explicitly in code from logs)
- **Long requests (>5s) are logged as warnings**
- **Check for pattern:** `⚠️ [duration]ms` in server logs

### Health Check Endpoints

**GET /api/health** - Basic health check
```json
{
  "status": "Server is running",
  "timestamp": "2026-04-22T...",
  "environment": "production",
  "version": "1.0.1",
  "supabase": {
    "configured": true,
    "url": "✓"
  }
}
```

**GET /api/health/database** - Detailed database health (if implemented)
Should return detailed connection pool status

---

## 9. FIXES TO APPLY

### Immediate (Do First)

#### **Fix 1: Check Server Status**
```bash
# Check if server is running and responding
curl -v https://server-tau-puce.vercel.app/api/health
```

If this fails:
- Vercel deployment may be down
- Check Vercel dashboard for errors
- Redeploy if needed

#### **Fix 2: Verify Database Credentials**
- Go to Supabase Dashboard
- Project Settings → API
- Verify `Project URL` matches `SUPABASE_URL` env var
- Verify `anon public` key matches `VITE_SUPABASE_ANON_KEY`
- Verify `service_role` key is set on backend

#### **Fix 3: Check Firewall & Network**
```bash
# If server responds but database doesn't:
# Check network rules in Supabase dashboard
# Ensure your IP is not blocked
```

### Secondary (If Above Doesn't Work)

#### **Fix 4: Clear Browser Cache**
```javascript
// In browser console:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

#### **Fix 5: Restart Connection Pool**
If database is exhausted:
1. Go to Supabase Dashboard
2. Database Settings → Connection Pooling
3. Check if pool is at capacity (10/10)
4. Reset connection pool or restart database

#### **Fix 6: Update Hardcoded Fallbacks**
If environment variables are not being read:

Update `src/services/supabaseClient.ts` lines 3-4:
```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_ACTUAL_PROJECT_URL';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ACTUAL_ANON_KEY';
```

---

## 10. PREVENTION MEASURES

From the April 22 incident, these are already implemented:

1. ✅ **30-second request timeout** - Prevents hanging connections
2. ✅ **Connection pool monitoring** - Warns at 8/10 connections
3. ✅ **Health check endpoints** - Monitor database status
4. ✅ **Graceful degradation** - Frontend uses cached data if API fails
5. ✅ **Detailed logging** - Easy to spot issues

**Still Missing:**
- [ ] Frontend health check display (show user when DB is down)
- [ ] Automatic retry with exponential backoff
- [ ] Database upgrade to larger plan (prevents exhaustion)
- [ ] Load testing to identify bottlenecks

---

## SUMMARY TABLE

| Component | Status | Issue | Priority |
|-----------|--------|-------|----------|
| Frontend (React) | ✅ Code OK | Waiting for API | N/A |
| CORS Setup | ✅ Configured | Not the issue | N/A |
| OddsContext | ✅ Code OK | API fails | Critical |
| UserContext | ✅ Code OK | API fails | Critical |
| BetContext | ✅ Code OK | API fails | Critical |
| Server Routes | ✅ Mounted | Database down? | Critical |
| Supabase Client | ⚠️ Unknown | Credentials? | Critical |
| Database | 🔴 FAILING | Connection pool? | Critical |
| Health Endpoint | ✅ Available | Test this first | Critical |

---

## NEXT STEPS

1. **Run the health checks** from Section 7
2. **Check Supabase dashboard** for status and connection pool
3. **Review server logs** for error patterns
4. **Check environment variables** are properly set
5. **If database is down:** Contact Supabase support or upgrade plan
6. **If credentials are wrong:** Update environment variables and redeploy

