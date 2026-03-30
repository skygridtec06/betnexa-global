/**
 * Debug script to test market save functionality
 * This will help identify where the market values are being lost
 */

import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'https://server-tau-puce.vercel.app';

async function testMarketSave() {
  try {
    console.log('\n🔍 Market Save Debug Script\n');
    console.log(`API URL: ${API_URL}\n`);

    // Step 1: Fetch all games
    console.log('1️⃣ Fetching all games...');
    let response = await fetch(`${API_URL}/api/admin/games`);
    let data = await response.json();
    
    if (!data.success || !data.games || data.games.length === 0) {
      console.error('❌ No games found');
      return;
    }

    const game = data.games.find(g => !g.id?.startsWith('af-'));
    if (!game) {
      console.error('❌ No manually-managed games found');
      return;
    }

    console.log(`✅ Found game: ${game.id} (${game.home_team} vs ${game.away_team})`);
    console.log(`   Current markets count: ${Object.keys(game.markets || {}).length}`);
    console.log(`   Sample markets: ${JSON.stringify(Object.entries(game.markets || {}).slice(0, 3))}\n`);

    // Step 2: Create test market values
    console.log('2️⃣ Creating test market values...');
    const testMarkets = {
      bttsYes: 1.80,
      over25: 1.95,
      doubleChanceHomeOrDraw: 1.55,
      cs10: 8.50,
    };
    console.log(`   Test values: ${JSON.stringify(testMarkets)}\n`);

    // Step 3: Save markets
    console.log('3️⃣ Saving markets via PUT /api/admin/games/{gameId}/markets...');
    response = await fetch(`${API_URL}/api/admin/games/${game.id}/markets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: 'admin@test.com',
        markets: testMarkets
      })
    });

    data = await response.json();
    console.log(`   Response: ${JSON.stringify(data)}`);
    
    if (!data.success) {
      console.error('❌ Market save failed');
      return;
    }
    console.log(`✅ Markets saved (${data.marketCount} entries)\n`);

    // Step 4: Immediately fetch games again
    console.log('4️⃣ Fetching games again immediately...');
    response = await fetch(`${API_URL}/api/admin/games`);
    data = await response.json();
    
    const updatedGame = data.games.find(g => g.id === game.id);
    if (!updatedGame) {
      console.error('❌ Game not found after update');
      return;
    }

    console.log(`   Markets count: ${Object.keys(updatedGame.markets || {}).length}`);
    console.log(`   Markets content: ${JSON.stringify(updatedGame.markets || {})}\n`);

    // Compare
    console.log('5️⃣ Comparing saved vs fetched...');
    let allMatch = true;
    for (const [key, expectedValue] of Object.entries(testMarkets)) {
      const fetchedValue = updatedGame.markets?.[key];
      const matches = fetchedValue === expectedValue;
      console.log(`   ${key}: Expected ${expectedValue}, Got ${fetchedValue} - ${matches ? '✅' : '❌'}`);
      if (!matches) allMatch = false;
    }

    if (allMatch) {
      console.log('\n✅ ALL MARKETS SAVED CORRECTLY');
    } else {
      console.log('\n❌ MARKETS NOT PERSISTED PROPERLY');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testMarketSave();
