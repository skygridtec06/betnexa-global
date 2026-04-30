#!/usr/bin/env node

/**
 * Debug game addition with detailed error info
 */

const API_URL = 'https://betnexa-globalback.vercel.app';
const ADMIN_PHONE = '0714945142';

const gameData = {
  phone: ADMIN_PHONE,
  league: 'Football',
  homeTeam: 'Northern Storm',
  awayTeam: 'Rampage Fc',
  homeOdds: 2.80,
  drawOdds: 3.58,
  awayOdds: 3.63,
  status: 'upcoming',
  time: '2026-02-23T23:00:00Z'
};

async function test() {
  console.log('\n🔍 Testing game creation with detailed output\n');
  console.log('Sending:', JSON.stringify(gameData, null, 2));

  try {
    const response = await fetch(`${API_URL}/api/admin/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gameData)
    });

    const text = await response.text();
    console.log('\n📨 Raw Response:');
    console.log(`Status: ${response.status}`);
    console.log(`Headers:`, Object.fromEntries(response.headers));
    console.log(`Body: ${text}`);

    try {
      const json = JSON.parse(text);
      console.log('\n📋 Parsed JSON:');
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('\n⚠️  Could not parse as JSON');
    }
  } catch (error) {
    console.error('\n❌ Fetch error:', error.message);
  }
}

test();
