/**
 * Find a fresh game and test 39 market preservation
 */

import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'https://server-tau-puce.vercel.app';

async function findAndTestFreshGame() {
  try {
    console.log('\n=== FINDING FRESH GAME FOR TEST ===\n');

    // Find a game with 39 markets that hasn't been tested yet
    let res = await fetch(`${API_URL}/api/admin/games`);
    let data = await res.json();
    
    const freshGames = data.games?.filter(g => {
      const isManual = !String(g.id || g.game_id).startsWith('af-');
      const marketCount = Object.keys(g.markets || {}).length;
      // Look for games with full market set (39 or more)
      return isManual && marketCount >= 35;
    }) || [];

    if (freshGames.length === 0) {
      console.log('❌ No suitable fresh games found');
      return;
    }

    // Use the last one (least likely to have been tested)
    const testGame = freshGames[freshGames.length - 1];
    const gameId = testGame.id || testGame.game_id;
    const initialMarkets = { ...testGame.markets };
    const initialCount = Object.keys(initialMarkets).length;

    console.log(`✅ Testing with: ${testGame.home_team} vs ${testGame.away_team}`);
    console.log(`   ID: ${gameId}`);
    console.log(`   Market count: ${initialCount}\n`);

    if (initialCount < 10) {
      console.log('⚠️ Game has few markets, test less effective');
    }

    // Test: Edit 3 markets only
    const editsToMake = {
      bttsYes: 1.55,
      over25: 1.65,
      under25: 2.15,
    };

    console.log(`Editing 3 markets (keeping ${initialCount - 3} others intact)...`);
    
    res = await fetch(`${API_URL}/api/admin/games/${gameId}/markets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: 'admin@test.com', markets: editsToMake })
    });
    data = await res.json();

    if (!data.success) {
      console.log(`❌ Save failed: ${data.error}`);
      return;
    }

    console.log(`✅ Save successful\n`);

    // Verify
    res = await fetch(`${API_URL}/api/admin/games`);
    data = await res.json();
    
    const updated = data.games.find(g => (g.id || g.game_id) === gameId);
    const finalCount = Object.keys(updated?.markets || {}).length;

    console.log(`Results:`);
    console.log(`  Before: ${initialCount} markets`);
    console.log(`  After: ${finalCount} markets`);

    if (finalCount === initialCount) {
      console.log(`  ✅ PRESERVATION SUCCESS: All ${initialCount} markets kept!`);
      
      // Verify the edits
      let allCorrect = true;
      for (const [key, expectedVal] of Object.entries(editsToMake)) {
        const actual = updated?.markets?.[key];
        const correct = parseFloat(actual) === parseFloat(expectedVal);
        console.log(`    ${correct ? '✅' : '❌'} ${key}: ${actual}`);
        if (!correct) allCorrect = false;
      }

      if (allCorrect) {
        console.log(`\n✅✅✅ COMPLETE SUCCESS!`);
        console.log(`   All markets preserved`);
        console.log(`   All edits correct`);
        console.log(`   NO DATA LOSS`);
      }
    } else {
      console.log(`  ❌ MARKETS LOST: ${initialCount - finalCount} markets disappeared!`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findAndTestFreshGame().catch(console.error);
