/**
 * Test: Send ONLY changed markets, not all generated ones
 */

import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'https://server-tau-puce.vercel.app';

async function testSendingOnlyChanged() {
  try {
    console.log('\n=== TEST: SEND ONLY 3 CHANGED MARKETS ===\n');

    // Get a fresh game
    let res = await fetch(`${API_URL}/api/admin/games`);
    let data = await res.json();
    
    const game = data.games?.find(g => {
      const isManual = !String(g.id || g.game_id).startsWith('af-');
      const hasMarkets = Object.keys(g.markets || {}).length >= 35;
      return isManual && hasMarkets;
    });

    if (!game || Object.keys(game.markets || {}).length < 35) {
      console.log('❌ No suitable game');
      return;
    }

    const gameId = game.id || game.game_id;
    const initialCount = Object.keys(game.markets || {}).length;
    const initialMarkets = {...game.markets};

    console.log(`Game: ${game.home_team} vs ${game.away_team}`);
    console.log(`Initial markets: ${initialCount}\n`);

    // Send ONLY 3 markets (not all generated ones)
    const onlyChanged = {
      bttsYes: 1.33,
      over25: 1.44,
      under25: 2.33,
    };

    console.log(`Sending 3 markets only:`);
    console.log(JSON.stringify(onlyChanged, null, 2));
    
    res = await fetch(`${API_URL}/api/admin/games/${gameId}/markets`, {
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: 'admin@test.com', markets: onlyChanged })
    });

    data = await res.json();

    if (!data.success) {
      console.log(`❌ Save failed: ${data.error}`);
      return;
    }

    console.log(`✅ Save successful\n`);

    // Fetch and check
    res = await fetch(`${API_URL}/api/admin/games`);
    data = await res.json();
    
    const updated = data.games.find(g => (g.id || g.game_id) === gameId);
    const finalCount = Object.keys(updated?.markets || {}).length;

    console.log(`RESULTS:`);
    console.log(`  Before: ${initialCount} markets`);
    console.log(`  After: ${finalCount} markets`);

    if (finalCount === initialCount) {
      console.log(`  ✅ ALL PRESERVED!`);
      
      // Check the edits
      for (const [key, expectedVal] of Object.entries(onlyChanged)) {
        const actual = updated?.markets?.[key];
        const correct = parseFloat(actual) === parseFloat(expectedVal);
        console.log(`    ${correct ? '✅' : '❌'} ${key}: ${actual}`);
      }
    } else {
      console.log(`  ❌ LOST: ${initialCount - finalCount} markets`);
      console.log(`\nThis test shows that even sending ONLY 3 markets results in loss.`);
      console.log(`This suggests the backend is not fetching or comparing existing markets correctly.`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSendingOnlyChanged().catch(console.error);
