/**
 * Database diagnostic - check what markets actually exist for a game
 */

import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'https://server-tau-puce.vercel.app';
const TEST_GAME_ID = '8902ba2e-0995-49b9-b4d1-a054e82ae042';

async function checkDatabase() {
  try {
    console.log('\n=== DATABASE DIAGNOSTIC ===\n');

    console.log('Fetching games from /api/admin/games...');
    const res = await fetch(`${API_URL}/api/admin/games`);
    const data = await res.json();
    
    const game = data.games?.find(g => (g.id || g.game_id) === TEST_GAME_ID);
    
    if (!game) {
      console.log(`❌ Game ${TEST_GAME_ID} not found`);
      return;
    }

    const markets = game.markets || {};
    const marketCount = Object.keys(markets).length;

    console.log(`Game: ${game.home_team} vs ${game.away_team}`);
    console.log(`Returned markets: ${marketCount}`);
    console.log(`\nMarket keys:`);
    
    Object.keys(markets).forEach(key => {
      console.log(`  - ${key}: ${markets[key]}`);
    });

    if (marketCount < 10) {
      console.log(`\n⚠️ Only ${marketCount} markets returned - expecting ~39`);
      console.log('This suggests markets were actually deleted from database');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDatabase().catch(console.error);
