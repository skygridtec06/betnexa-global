const express = require('express');
const cors = require('cors');
require('dotenv').config();
const https = require('https');
const PaymentRoutes = require('./routes/payment.routes.js');
const CallbackRoutes = require('./routes/callback.routes.js');
const AuthRoutes = require('./routes/auth.routes.js');
const AdminRoutes = require('./routes/admin.routes.js');
const BetsRoutes = require('./routes/bets.routes.js');
// const PresenceRoutes = require('./routes/presence.routes.js');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['https://betnexa.vercel.app', 'https://betnexa-server.vercel.app', 'http://localhost:8080', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', AuthRoutes);
app.use('/api/payments', PaymentRoutes);
app.use('/api/callbacks', CallbackRoutes);
app.use('/api/admin', AdminRoutes);
app.use('/api/bets', BetsRoutes);
// app.use('/api/presence', PresenceRoutes);

// Health check
// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('🏥 Health check requested');
  res.json({
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.1',
    supabase: process.env.SUPABASE_URL ? 'configured' : 'NOT configured',
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
});

module.exports = app;
