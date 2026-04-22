// Force Vercel rebuild - 2026-04-05 earnings fix deployment
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const https = require('https');
const PaymentRoutes = require('./routes/payment.routes.js');
const CallbackRoutes = require('./routes/callback.routes.js');
const AuthRoutes = require('./routes/auth.routes.js');
const AdminRoutes = require('./routes/admin.routes.js');
const FetchApiFootballRoutes = require('./routes/fetch-api-football-games.js');
const BetsRoutes = require('./routes/bets.routes.js');
const LiveRoutes = require('./routes/live.routes.js');
const CronRoutes = require('./routes/cron.routes.js');
const { startMatchEventScheduler } = require('./services/matchScheduler');
const PresenceRoutes = require('./routes/presence.routes.js');
const databaseHealthMonitor = require('./services/databaseHealthMonitor');

const app = express();
const PORT = process.env.PORT || 5000;

const defaultAllowedOrigins = [
  'https://betnexa.vercel.app',
  'https://betnexa-server.vercel.app',
  'https://betnexa.co.ke',
  'https://www.betnexa.co.ke',
  'http://localhost:8080',
  'http://localhost:3000',
];

const envAllowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...envAllowedOrigins])];

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser clients or same-origin requests without Origin header.
    if (!origin) {
      console.log('[CORS] No origin provided, allowing');
      return callback(null, true);
    }

    // Normalize origin for comparison (remove www for checking)
    const normalizedOrigin = origin.replace('www.', '');
    const normalizedAllowedOrigins = allowedOrigins.map(o => o.replace('www.', ''));

    // Allow specific whitelisted origins (with normalization)
    if (normalizedAllowedOrigins.includes(normalizedOrigin)) {
      console.log(`[CORS] ✅ Origin allowed (in whitelist): ${origin}`);
      // Return the origin that was actually requested to satisfy credentials: true
      return callback(null, origin);
    }

    // Allow all vercel.app subdomains (for preview deployments)
    if (origin.includes('.vercel.app') || origin.includes('vercel.app')) {
      console.log(`[CORS] ✅ Origin allowed (Vercel domain): ${origin}`);
      return callback(null, origin);
    }

    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      console.log(`[CORS] ✅ Origin allowed (localhost): ${origin}`);
      return callback(null, origin);
    }

    console.log(`[CORS] ❌ Origin blocked: ${origin}`);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request timeout middleware - prevent hanging connections
app.use((req, res, next) => {
  // Set socket timeout to 30 seconds
  req.socket.setTimeout(30000);
  res.setTimeout(30000, () => {
    console.error(`⏱️  Request timeout: ${req.method} ${req.path}`);
    res.status(408).json({ error: 'Request timeout - server response delayed' });
  });
  next();
});

// Request logging with performance monitoring
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function (data) {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    
    if (duration > 5000) {
      console.warn(`⚠️  [${duration}ms] ${req.method} ${req.path} - Status ${statusCode}`);
    } else {
      console.log(`📨 [${duration}ms] ${req.method} ${req.path} - Status ${statusCode}`);
    }
    
    return originalSend.call(this, data);
  };
  
  next();
});

// Routes
app.use('/api/auth', AuthRoutes);
app.use('/api/payments', PaymentRoutes);
app.use('/api/callbacks', CallbackRoutes);
app.use('/api/admin/fetch-api-football', FetchApiFootballRoutes);  // Mount specific routes BEFORE general /api/admin
app.use('/api/admin', AdminRoutes);
app.use('/api/bets', BetsRoutes);
app.use('/api/live', LiveRoutes);
app.use('/api/cron', CronRoutes);
app.use('/api/presence', PresenceRoutes);

// Health check
// Enhanced health check endpoint with database status
app.get('/api/health', (req, res) => {
  console.log('🏥 Health check requested');
  const dbStatus = databaseHealthMonitor.getHealthResponse();
  
  res.json({
    status: dbStatus.status === 'healthy' ? 'Server is running' : 'Server running but database unstable',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.1',
    supabase: {
      configured: process.env.SUPABASE_URL ? true : false,
      url: process.env.SUPABASE_URL ? '✓' : 'NOT configured',
      health: dbStatus.status,
      database: dbStatus.database,
    },
  });
});

// Database diagnostics endpoint
app.get('/api/health/database', (req, res) => {
  const status = databaseHealthMonitor.getStatus();
  const code = status.healthy ? 200 : 503;
  
  res.status(code).json({
    healthy: status.healthy,
    metrics: status.metrics,
    recentAlerts: status.recentAlerts.map(a => ({
      level: a.level,
      message: a.message,
      timestamp: a.timestamp,
    })),
  });
});

// Diagnostic endpoint to verify routes are loaded
app.get('/api/diagnostics', (req, res) => {
  res.json({
    server_status: 'running',
    cors_origins: allowedOrigins,
    fetch_api_football_routes: ['/fetch-preview', '/test', '/execute', 'GET /'],
    admin_routes_mounted: true,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.listen(PORT, () => {
  console.log(`\n✅ PayHero Payment Server running on port ${PORT}`);
  console.log(`📍 API: http://localhost:${PORT}/api`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\n💳 Ready to process M-Pesa payments!\n`);

  // ⛔ Match event scheduler DISABLED - Admin will manually fetch matches via API only
  // startMatchEventScheduler(5000); // Check every 5 seconds
});

module.exports = app;
