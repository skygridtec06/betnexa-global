// Test the live backend PUT /api/admin/games/:gameId/markets endpoint
const fetch = require('node-fetch') || globalThis.fetch;

async function testBackendMarketUpdate() {
  const apiUrl = 'https://betnexa-globalback.vercel.app';
  const gameId = 'g1775462987782'; // Manual game from DB test
  
  // Step 1: Get current game state via the GET endpoint
  console.log('\n=== Step 1: Fetch current game state ===');
  const gamesRes = await (await globalThis.fetch(`${apiUrl}/api/admin/games`)).json();
  const game = gamesRes.games?.find(g => g.game_id === gameId);
  
  if (!game) {
    console.log('Game not found in GET /games response. Available game_ids:');
    gamesRes.games?.slice(0, 10).forEach(g => console.log(`  ${g.game_id}: ${g.home_team} vs ${g.away_team}`));
    return;
  }
  
  console.log(`Game: ${game.home_team} vs ${game.away_team}`);
  console.log(`Current markets:`, Object.keys(game.markets || {}).length, 'markets');
  const currentBttsYes = game.markets?.bttsYes;
  console.log(`Current bttsYes: ${currentBttsYes}`);
  
  // Step 2: Call PUT endpoint to update bttsYes to a test value
  const testValue = currentBttsYes === 77.77 ? 66.66 : 77.77;
  console.log(`\n=== Step 2: PUT /markets - bttsYes from ${currentBttsYes} to ${testValue} ===`);
  
  const putRes = await globalThis.fetch(`${apiUrl}/api/admin/games/${gameId}/markets`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: '0708747274', // admin phone
      markets: {
        bttsYes: testValue
      }
    })
  });
  
  const putData = await putRes.json();
  console.log('PUT response status:', putRes.status);
  console.log('PUT response:', JSON.stringify(putData, null, 2));
  
  // Step 3: Fetch again to verify
  console.log('\n=== Step 3: Verify via GET ===');
  const verifyRes = await (await globalThis.fetch(`${apiUrl}/api/admin/games`)).json();
  const verifiedGame = verifyRes.games?.find(g => g.game_id === gameId);
  
  if (verifiedGame) {
    const newBttsYes = verifiedGame.markets?.bttsYes;
    console.log(`After update - bttsYes: ${newBttsYes}`);
    console.log(`Expected: ${testValue}`);
    console.log(`Match: ${Math.abs(newBttsYes - testValue) < 0.01 ? '✅ YES' : '❌ NO'}`);
    
    if (Math.abs(newBttsYes - testValue) > 0.01) {
      console.log('\n❌ CONFIRMED: Backend says success but value NOT persisted!');
      console.log(`  Old value still showing: ${newBttsYes}`);
    }
  }
  
  // Step 4: Restore original value
  if (currentBttsYes && currentBttsYes !== testValue) {
    console.log(`\n=== Step 4: Restore bttsYes to ${currentBttsYes} ===`);
    await globalThis.fetch(`${apiUrl}/api/admin/games/${gameId}/markets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '0708747274',
        markets: { bttsYes: currentBttsYes }
      })
    });
    console.log('Restored');
  }
}

testBackendMarketUpdate().catch(console.error);
