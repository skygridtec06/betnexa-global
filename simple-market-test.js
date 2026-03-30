/**
 * Simpler diagnostic - one-shot test of market persistence
 */

import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'https://server-tau-puce.vercel.app';

async function runDiagnostic() {
  try {
    console.log('\n=== MARKET PERSISTENCE TEST ===\n');

    // Step 1: Get a test game
    console.log('1️⃣ Fetching games...');
    let res = await fetch(`${API_URL}/api/admin/games`);
    let data = await res.json();
    
    const game = data.games?.find(g => !String(g.id || g.game_id).startsWith('af-'));
    if (!game) {
      console.log('❌ No manual games found');
      return;
    }

    const gameId = game.id || game.game_id;
    console.log(`✅ Using game: ${gameId}`);
    console.log(`   Current markets: ${Object.keys(game.markets || {}).length}`);
    console.log(`   Sample: ${JSON.stringify(Object.entries(game.markets || {}).slice(0, 2))}`);

    // Step 2: Save new markets
    console.log('\n2️⃣ Saving test markets...');
    const testMarkets = {
      bttsYes: 1.77,
      over25: 1.89,
      doubleChanceHomeOrDraw: 1.53,
    };

    res = await fetch(`${API_URL}/api/admin/games/${gameId}/markets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: 'admin@test.com', markets: testMarkets })
    });
    data = await res.json();
    
    console.log(`✅ Save response:`, {
      success: data.success,
      marketCount: data.marketCount,
      hasSavedMarkets: !!data.savedMarkets
    });

    // Step 3: Fetch immediately and verify
    console.log('\n3️⃣ Fetching immediately after save...');
    res = await fetch(`${API_URL}/api/admin/games`);
    data = await res.json();
    
    const updatedGame = data.games.find(g => (g.id || g.game_id) === gameId);
    if (!updatedGame) {
      console.log('❌ Game not found!');
      return;
    }

    console.log(`   Total markets: ${Object.keys(updatedGame.markets || {}).length}`);
    
    // Check if test markets are present
    console.log('\n   TEST MARKETS VERIFICATION:');
    let allPresent = true;
    for (const [key, expectedVal] of Object.entries(testMarkets)) {
      const actual = updatedGame.markets?.[key];
      const present = actual !== undefined;
      const matches = present && parseFloat(actual) === parseFloat(expectedVal);
      
      const status = matches ? '✅' : present ? '⚠️' : '❌';
      console.log(`   ${status} ${key}: expected=${expectedVal}, actual=${actual}`);
      
      if (!present) allPresent = false;
    }

    if (allPresent) {
      console.log('\n   ✅ ALL TEST MARKETS PRESENT AND CORRECT');
    } else {
      console.log('\n   ⚠️ SOME TEST MARKETS MISSING OR INCORRECT');
    }

    // Step 4: Wait and fetch again
    console.log('\n4️⃣ Waiting 2 seconds and fetching again...');
    await new Promise(r => setTimeout(r, 2000));
    
    res = await fetch(`${API_URL}/api/admin/games`);
    data = await res.json();
    
    const gameAfterWait = data.games.find(g => (g.id || g.game_id) === gameId);
    console.log(`   Total markets: ${Object.keys(gameAfterWait?.markets || {}).length}`);
    
    console.log('\n   SECOND FETCH - TEST MARKETS:');
    let stillPresent = true;
    for (const [key, expectedVal] of Object.entries(testMarkets)) {
      const actual = gameAfterWait?.markets?.[key];
      const present = actual !== undefined;
      const matches = present && parseFloat(actual) === parseFloat(expectedVal);
      
      const status = matches ? '✅' : present ? '⚠️' : '❌';
      console.log(`   ${status} ${key}: expected=${expectedVal}, actual=${actual}`);
      
      if (!present) stillPresent = false;
    }

    // Final verdict
    console.log('\n' + '='.repeat(50));
    if (allPresent && stillPresent) {
      console.log('✅ MARKETS PERSISTED CORRECTLY!');
      console.log('   Changes visible immediately and after delay');
      console.log('   NO PERSISTENCE ISSUES DETECTED');
    } else if (allPresent && !stillPresent) {
      console.log('❌ MARKETS DISAPPEARED AFTER DELAY!');
      console.log('   Issue: Background sync or regeneration is overwriting values');
    } else {
      console.log('❌ MARKETS NEVER SAVED!');
      console.log('   Issue: Save operation failed or DB insert failed');
    }
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

runDiagnostic().catch(console.error);
