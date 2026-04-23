#!/usr/bin/env node

/**
 * Test actual API queries to verify database functionality
 */

const https = require('https');

function testEndpoint(url, label) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const duration = Date.now() - startTime;
        const statusOk = res.statusCode === 200 || res.statusCode === 401;
        
        console.log(`\n${statusOk ? '✅' : '❌'} ${label}`);
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Duration: ${duration}ms`);
        
        if (data && data.length < 500) {
          try {
            const json = JSON.parse(data);
            console.log(`   Response:`, JSON.stringify(json, null, 2));
          } catch (e) {
            console.log(`   Response: ${data.substring(0, 200)}...`);
          }
        }
        
        resolve({ label, status: res.statusCode, duration });
      });
    }).on('error', (err) => {
      const duration = Date.now() - startTime;
      console.log(`\n❌ ${label}`);
      console.log(`   Error: ${err.message}`);
      console.log(`   Duration: ${duration}ms`);
      resolve({ label, status: 'ERROR', duration });
    }).setTimeout(10000);
  });
}

async function runTests() {
  console.log('🧪 Testing BETNEXA API Endpoints\n');
  console.log('═'.repeat(50));
  
  const tests = [
    ['https://betnexa.co.ke/api/health', 'Basic Health Check'],
    ['https://betnexa.co.ke/api/diagnostics', 'Diagnostics'],
    ['https://betnexa.co.ke/fetch-api-football/games', 'Games List'],
    ['https://betnexa.co.ke/api/games', 'Alternative Games Endpoint'],
  ];
  
  const results = [];
  for (const [url, label] of tests) {
    const result = await testEndpoint(url, label);
    results.push(result);
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log('\n📊 Summary:');
  console.log('─'.repeat(50));
  
  results.forEach(r => {
    const status = typeof r.status === 'number' ? `${r.status}` : r.status;
    const indicator = r.status === 200 || (typeof r.status === 'number' && r.status < 500) ? '✅' : '❌';
    console.log(`${indicator} ${r.label.padEnd(30)} - ${status.padEnd(8)} (${r.duration}ms)`);
  });
  
  // Check if any endpoints are working
  const working = results.filter(r => r.status === 200).length;
  console.log(`\n${working > 0 ? '✅' : '❌'} ${working}/${results.length} endpoints responding\n`);
}

runTests().catch(console.error);
