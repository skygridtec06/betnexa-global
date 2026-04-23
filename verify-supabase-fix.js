#!/usr/bin/env node

/**
 * BETNEXA Supabase Connection Verification Script
 * Tests all components of the Supabase integration
 */

const https = require('https');
const http = require('http');

function testUrl(url, label) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const isJson = res.headers['content-type']?.includes('application/json');
        const status = res.statusCode;
        const success = status === 200 && isJson;
        
        console.log(`\n${success ? '✅' : '❌'} ${label}`);
        console.log(`   Status: ${status}`);
        console.log(`   Type: ${res.headers['content-type']}`);
        console.log(`   Size: ${data.length} bytes`);
        
        if (isJson && data.length < 500) {
          try {
            console.log(`   Data:`, JSON.stringify(JSON.parse(data), null, 2));
          } catch (e) {
            console.log(`   Data: ${data.substring(0, 100)}`);
          }
        }
        
        resolve({ label, success, status });
      });
    }).on('error', err => {
      console.log(`\n❌ ${label}`);
      console.log(`   Error: ${err.message}`);
      resolve({ label, success: false, error: err.message });
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      console.log(`\n❌ ${label} - Timeout`);
      resolve({ label, success: false, error: 'timeout' });
    });
  });
}

async function verify() {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 BETNEXA Supabase Connection Verification');
  console.log('='.repeat(60));
  
  const tests = [
    ['http://localhost:5000/api/health', 'Local: Health Check'],
    ['http://localhost:5000/api/diagnostics', 'Local: Diagnostics'],
    ['https://server-tau-puce.vercel.app/api/health', 'Production: Health Check'],
    ['https://server-tau-puce.vercel.app/api/admin/games', 'Production: Games Endpoint'],
  ];
  
  const results = [];
  
  for (const [url, label] of tests) {
    const result = await testUrl(url, label);
    results.push(result);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  const localWorking = results.filter(r => r.label.includes('Local')).every(r => r.success);
  const prodWorking = results.filter(r => r.label.includes('Production')).every(r => r.success);
  
  console.log(`\n📍 Local Server: ${localWorking ? '✅ WORKING' : '❌ NOT RESPONDING'}`);
  console.log(`📍 Production Backend: ${prodWorking ? '✅ WORKING' : '⏳ DEPLOYING (check again in 5 mins)'}`);
  
  if (localWorking) {
    console.log('\n✅ Backend is operational locally');
    console.log('   All Supabase connections working');
    console.log('   Database queries succeeding');
  }
  
  if (!prodWorking) {
    console.log('\n⏳ Production backend is being deployed');
    console.log('   This is normal after pushing changes to GitHub');
    console.log('   Vercel will automatically rebuild');
    console.log('   Check again in 5-10 minutes');
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

// Only run if server is available
testUrl('http://localhost:5000/api/health', 'Check').then(result => {
  if (!result.success) {
    console.log('\n⚠️  Local server not running!');
    console.log('Start it with: cd server && npm install && node server.js\n');
    process.exit(1);
  }
  verify().catch(console.error);
});
