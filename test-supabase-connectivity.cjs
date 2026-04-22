const https = require('https');

const supabaseUrl = 'https://eaqogmybihiqzivuwyav.supabase.co';

console.log('\n🔍 SUPABASE CONNECTIVITY DIAGNOSTIC');
console.log('═'.repeat(50));
console.log(`Testing: ${supabaseUrl}\n`);

// Test 1: Basic HTTPS connectivity
console.log('🧪 TEST 1: HTTPS Connectivity');
console.log('─'.repeat(50));

const testUrl = new URL(supabaseUrl);

https.get(`${supabaseUrl}/rest/v1/`, { timeout: 5000 }, (res) => {
  console.log(`✅ HTTP Status: ${res.statusCode}`);
  console.log(`✅ Server is reachable`);
  printSummary();
}).on('error', (err) => {
  console.log(`❌ Connection Error: ${err.message}`);
  console.log(`❌ Server is NOT reachable\n`);
  
  // Diagnose the error type
  if (err.code === 'ECONNREFUSED') {
    console.log('   Issue: Connection refused by server');
    console.log('   Cause: Server is down or not accepting connections');
  } else if (err.code === 'ETIMEDOUT') {
    console.log('   Issue: Connection timeout');
    console.log('   Cause: Network unreachable or server not responding');
  } else if (err.code === 'ENOTFOUND') {
    console.log('   Issue: DNS resolution failed');
    console.log('   Cause: Domain name cannot be resolved');
  } else if (err.code === 'EHOSTUNREACH') {
    console.log('   Issue: Host unreachable');
    console.log('   Cause: Network is down or routing issue');
  }
  
  printSummary();
});

function printSummary() {
  console.log('\n📋 DIAGNOSIS SUMMARY');
  console.log('═'.repeat(50));
  
  console.log('\n⚠️  "Unhealthy" Status Root Causes:');
  console.log('   1. Database service is down (most likely)');
  console.log('   2. Network connectivity issue');
  console.log('   3. Firewall blocking connections');
  console.log('   4. DNS resolution problems');
  console.log('   5. Connection pool exhaustion');
  
  console.log('\n✅ Immediate Actions to Take:');
  console.log('   1. Go to https://app.supabase.com');
  console.log('   2. Select your project: skygridtec06');
  console.log('   3. Check Database Status page');
  console.log('   4. Look for status alerts or incidents');
  console.log('   5. Check resource usage (CPU, memory, connections)');
  
  console.log('\n🔧 Advanced Checks:');
  console.log('   1. Database > Settings > Connection Pooling');
  console.log('   2. Database > Logs > Query Performance');
  console.log('   3. Check for table locks: SELECT * FROM pg_locks;');
  console.log('   4. Monitor active connections');
  console.log('   5. Review recent migrations or schema changes');
  
  console.log('\n⚡ Emergency Recovery:');
  console.log('   1. Try restarting the database (Supabase UI)');
  console.log('   2. Upgrade instance size if needed');
  console.log('   3. Enable connection pooling');
  console.log('   4. Clear unused connections');
  console.log('   5. Contact Supabase support: support@supabase.com');
  
  console.log('\n🌐 Check Supabase Status:');
  console.log('   1. Visit https://status.supabase.com');
  console.log('   2. Check for any Ireland (eu-west-1) incidents');
  console.log('   3. Monitor official status updates');
  
  console.log('\n═'.repeat(50) + '\n');
  process.exit(0);
}
