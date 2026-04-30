/**
 * Test to log backend behavior
 */

import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'https://betnexa-globalback.vercel.app/';

async function testWithLogging() {
  try {
    console.log('\n=== BACKEND LOGGING TEST ===\n');

    // Get a game  with 39 markets
    let res = await fetch(`${API_URL}/api/admin/games`);
    let data = await res.json();
    
    const game = data.games?.find(g => {
      const isManual = !String(g.id || g.game_id).startsWith('af-');
      const hasMarkets = Object.keys(g.markets || {}).length >= 35;
      return isManual && hasMarkets;
    });

    if (!game || Object.keys(game.markets || {}).length < 35) {
      console.log('❌ No suitable game found');
      return;
    }

    const gameId = game.id || game.game_id;
    const initialCount = Object.keys(game.markets || {}).length;

    console.log(`Testing game with ${initialCount} markets`);
    console.log(`ID: ${gameId}\n`);

    // Send only 3 edited markets
    const editsToSend = {
      bttsYes: 1.44,
      over25: 1.56,
      under25: 2.44,
    };

    console.log(`Sending 3 markets to edit...`);
    console.log(JSON.stringify(editsToSend, null, 2));
    
    res = await fetch(`${API_URL}/api/admin/games/${gameId}/markets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: 'admin@test.com', markets: editsToSend })
    });

    data = await res.json();
    console.log(`\nResponse:`, JSON.stringify(data, null, 2));

    // Check result immediately
    console.log('\nFetching game immediately after save...');
    res = await fetch(`${API_URL}/api/admin/games`);
    data = await res.json();
    
    const updated = data.games.find(g => (g.id || g.game_id) === gameId);
    const finalCount = Object.keys(updated?.markets || {}).length;

    console.log(`\nResult:`);
    console.log(`  Before: ${initialCount}`);
    console.log(`  After: ${finalCount}`);
    console.log(`  Difference: ${initialCount - finalCount} lost`);

    if (finalCount < 10) {
      console.log(`\n❌ Only ${finalCount} markets remain - ${initialCount - finalCount} were deleted`);
      console.log('\nThis indicates that markets with the same key as sent were all deleted,');
      console.log('even if they weren\'t changed in value.');
      console.log('\nProblem: Backend might not be fetching existing markets correctly');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testWithLogging().catch(console.error);
