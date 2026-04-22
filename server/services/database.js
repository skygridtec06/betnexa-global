/**
 * Database Service
 * Handles database connections (using Supabase) with connection pooling and monitoring
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://eaqogmybihiqzivuwyav.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

console.log('🔧 Database initialization:');
console.log('   SUPABASE_URL:', supabaseUrl ? '✓ configured' : '❌ missing');
console.log('   SUPABASE_KEY:', supabaseKey ? '✓ configured' : '❌ missing');

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Warning: Missing SUPABASE_URL or SUPABASE_KEY');
  console.warn('   Games API will return empty results');
}

let supabase = null;
let dbHealthStatus = { healthy: false, lastCheck: null, consecutiveFailures: 0 };

try {
  supabase = createClient(supabaseUrl, supabaseKey);
  
  // Test connection
  console.log('🔌 Testing Supabase connection...');
  supabase
    .from('users')
    .select('count(*)', { count: 'exact', head: true })
    .then(({ data, error, count }) => {
      if (error) {
        console.warn('⚠️ Supabase connection warning:', error.message || JSON.stringify(error));
        dbHealthStatus.healthy = false;
      } else {
        console.log('✅ Supabase connected successfully');
        dbHealthStatus.healthy = true;
        dbHealthStatus.consecutiveFailures = 0;
      }
    })
    .catch(error => {
      console.warn('⚠️ Supabase connection check failed:', error.message || JSON.stringify(error));
      dbHealthStatus.healthy = false;
    });
} catch (error) {
  console.warn('⚠️ Supabase initialization warning:', error.message);
  console.warn('   Games API will return empty results');
  dbHealthStatus.healthy = false;
}

// Connection pool monitoring - runs every 60 seconds
let monitoringActive = false;
function startConnectionPoolMonitoring() {
  if (monitoringActive) return;
  monitoringActive = true;
  
  console.log('🔍 Starting database connection pool monitoring...');
  
  setInterval(async () => {
    try {
      // Check active connections (with timeout)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection pool check timeout')), 5000)
      );
      
      const checkPromise = supabase
        .from('pg_stat_activity')
        .select('count', { count: 'exact', head: true });
      
      const { count, error } = await Promise.race([checkPromise, timeoutPromise]);
      
      if (error) {
        dbHealthStatus.consecutiveFailures++;
        dbHealthStatus.healthy = false;
        
        if (dbHealthStatus.consecutiveFailures >= 3) {
          console.error('🚨 CRITICAL: Database failing consistently!');
          console.error('   Consecutive failures:', dbHealthStatus.consecutiveFailures);
          console.error('   Action: Check Supabase dashboard immediately');
        }
      } else {
        dbHealthStatus.healthy = true;
        dbHealthStatus.consecutiveFailures = 0;
        dbHealthStatus.lastCheck = new Date();
        
        // Warn if connection pool is near capacity (8+ of 10)
        if (count && count >= 8) {
          console.warn(`⚠️  CONNECTION POOL WARNING: ${count}/10 connections in use`);
        } else if (count && count >= 6) {
          console.log(`📊 Connection pool status: ${count}/10 in use`);
        }
      }
    } catch (err) {
      dbHealthStatus.consecutiveFailures++;
      dbHealthStatus.healthy = false;
      console.error('❌ Connection pool monitoring error:', err.message);
    }
  }, 60000); // Check every 60 seconds
}

// Start monitoring when database is ready
if (supabase) {
  setTimeout(() => startConnectionPoolMonitoring(), 5000);
}

// Export database and health status
module.exports = supabase;
module.exports.getHealthStatus = () => dbHealthStatus;
module.exports.isHealthy = () => dbHealthStatus.healthy;
