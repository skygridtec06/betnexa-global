#!/usr/bin/env node

/**
 * Simple API Test
 * Tests the admin games API and shows raw responses
 */

const API_URL = 'https://betnexa-globalback.vercel.app/';

async function testAPI() {
  console.log('\n🔍 Testing Admin Games API');
  console.log('============================\n');

  try {
    console.log('📨 GET /api/admin/games');
    const res = await fetch(`${API_URL}/api/admin/games`);
    console.log('Status:', res.status);
    console.log('Headers:', {
      'content-type': res.headers.get('content-type'),
      'x-powered-by': res.headers.get('x-powered-by')
    });
    
    const data = await res.text();
    console.log('Response:', data);
    console.log();

    // Try parsing as JSON
    try {
      const jsonData = JSON.parse(data);
      console.log('Parsed JSON:', JSON.stringify(jsonData, null, 2));
    } catch (e) {
      console.log('(Not valid JSON)');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPI();
