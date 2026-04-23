#!/usr/bin/env node

/**
 * Diagnostic: Simulate browser requests to identify what's failing
 */

const https = require('https');

function makeRequest(method, path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'https://betnexa.co.ke');
    
    const requestOptions = {
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: 10000
    };

    const req = https.request(url, requestOptions, (res) => {
      let data = '';
      
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data.length > 0 ? data.substring(0, 1000) : '(empty)',
          dataLength: data.length
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function diagnose() {
  console.log('\n🔍 BETNEXA Frontend Load Diagnostic');
  console.log('═'.repeat(60));

  const endpoints = [
    { method: 'GET', path: '/api/health', name: 'Health Check' },
    { method: 'GET', path: '/api/games', name: 'Games List (v1)' },
    { method: 'GET', path: '/fetch-api-football/games', name: 'Games List (v2)' },
    { method: 'GET', path: '/', name: 'Home Page (HTML)' },
  ];

  for (const endpoint of endpoints) {
    console.log(`\n📍 ${endpoint.name}`);
    console.log(`   ${endpoint.method} ${endpoint.path}`);
    console.log('   ' + '─'.repeat(50));

    try {
      const result = await makeRequest(endpoint.method, endpoint.path);
      
      console.log(`   ✅ Status: ${result.status}`);
      console.log(`   📦 Data length: ${result.dataLength} bytes`);
      
      if (result.dataLength > 0 && result.dataLength < 500) {
        try {
          const json = JSON.parse(result.data);
          console.log(`   📄 Response:`, JSON.stringify(json, null, 3).split('\n').slice(0, 10).join('\n   '));
        } catch (e) {
          console.log(`   📄 Response:`, result.data.substring(0, 200));
        }
      } else if (result.dataLength > 500) {
        console.log(`   📄 Response: (${result.dataLength} bytes)`);
        // Check if it's HTML
        if (result.data.includes('<html') || result.data.includes('<!DOCTYPE')) {
          console.log(`   📝 HTML page returned`);
        } else {
          console.log(`   ${result.data.substring(0, 150)}...`);
        }
      }
      
      // Check for CORS headers
      if (result.headers['access-control-allow-origin']) {
        console.log(`   ✅ CORS enabled:`, result.headers['access-control-allow-origin']);
      } else {
        console.log(`   ⚠️  No CORS header`);
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('\n💡 Common Issues:');
  console.log('   1. Check if API returns data for /api/games');
  console.log('   2. Verify CORS headers are present');
  console.log('   3. Check if home page HTML loads correctly');
  console.log('   4. Review browser DevTools Network & Console tabs\n');
}

diagnose().catch(console.error);
