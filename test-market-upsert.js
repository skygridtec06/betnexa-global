/**
 * Advanced Market Upsert Test
 * Tests that:
 * 1. Existing markets are preserved
 * 2. Only edited markets are updated
 * 3. No markets are lost during edit
 */

import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'https://server-tau-puce.vercel.app';

async function testUpsertBehavior() {
  try {
    console.log('\n=== MARKET UPSERT BEHAVIOR TEST ===\n');

    // Step 1: Get a test game and note existing market count
    console.log('1️⃣ Initial state check...');
    let res = await fetch(`${API_URL}/api/admin/games`);
    let data = await res.json();
    
    const game = data.games?.find(g => !String(g.id || g.game_id).startsWith('af-'));
    if (!game) {
      console.log('❌ No manual games found');
      return;
    }

    const gameId = game.id || game.game_id;
    const initialMarketCount = Object.keys(game.markets || {}).length;
    console.log(`✅ Test game: ${gameId}`);
    console.log(`   📊 Initial market count: ${initialMarketCount}`);
    
    if (initialMarketCount < 10) {
      console.log(`   ⚠️ Only ${initialMarketCount} markets (test works better with more)`);
    }

    const initialMarkets = { ...game.markets };

    // Step 2: Edit only 3 markets
    console.log('\n2️⃣ Editing only 3 markets (preserving others)...');
    const editedMarkets = {
      bttsYes: 1.81,
      over25: 1.92,
      doubleChanceHomeOrDraw: 1.57,
    };

    res = await fetch(`${API_URL}/api/admin/games/${gameId}/markets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: 'admin@test.com', markets: editedMarkets })
    });
    data = await res.json();
    
    console.log(`✅ Save response:`, {
      success: data.success,
      marketCount: data.marketCount
    });

    // Step 3: Fetch and verify
    console.log('\n3️⃣ Verifying markets after edit...');
    res = await fetch(`${API_URL}/api/admin/games`);
    data = await res.json();
    
    const updatedGame = data.games.find(g => (g.id || g.game_id) === gameId);
    if (!updatedGame) {
      console.log('❌ Game not found!');
      return;
    }

    const afterMarketCount = Object.keys(updatedGame.markets || {}).length;
    console.log(`   📊 Market count after edit: ${afterMarketCount}`);
    
    // Critical check: Did we preserve ALL markets?
    if (afterMarketCount < initialMarketCount) {
      console.log(`   ❌ CRITICAL: Lost ${initialMarketCount - afterMarketCount} markets!`);
      console.log(`      Initial: ${initialMarketCount}, After: ${afterMarketCount}`);
    } else if (afterMarketCount > initialMarketCount) {
      console.log(`   ℹ️ Market count increased (${initialMarketCount} -> ${afterMarketCount})`);
    } else {
      console.log(`   ✅ Market count preserved (${afterMarketCount})`);
    }

    // Check which markets changed
    console.log('\n   EDITED MARKETS:');
    for (const [key, newValue] of Object.entries(editedMarkets)) {
      const oldValue = initialMarkets[key];
      const currentValue = updatedGame.markets?.[key];
      
      if (!oldValue) {
        console.log(`   ℹ️ ${key}: NEW (${oldValue} -> ${currentValue})`);
      } else if (parseFloat(currentValue) === parseFloat(newValue)) {
        console.log(`   ✅ ${key}: Updated correctly (${oldValue} -> ${currentValue})`);
      } else {
        console.log(`   ❌ ${key}: Update failed (expected ${newValue}, got ${currentValue})`);
      }
    }

    console.log('\n   PRE-EXISTING MARKETS:');
    let preservedCount = 0;
    let changedCount = 0;
    
    for (const [key, oldValue] of Object.entries(initialMarkets)) {
      if (editedMarkets[key]) continue; // Skip edited ones
      
      const currentValue = updatedGame.markets?.[key];
      
      if (currentValue === undefined) {
        console.log(`   ❌ ${key}: LOST (was ${oldValue})`);
      } else if (parseFloat(currentValue) === parseFloat(oldValue)) {
        if (preservedCount < 5) { // Only show first 5
          console.log(`   ✅ ${key}: Preserved (${currentValue})`);
        }
        preservedCount++;
      } else {
        console.log(`   ⚠️ ${key}: CHANGED unexpectedly (${oldValue} -> ${currentValue})`);
        changedCount++;
      }
    }
    
    if (preservedCount > 5) {
      console.log(`   ✅ ... and ${preservedCount - 5} more markets preserved`);
    }

    // Final verdict
    console.log('\n' + '='.repeat(60));
    
    if (afterMarketCount === initialMarketCount && changedCount === 0) {
      console.log('✅ UPSERT WORKING CORRECTLY!');
      console.log(`   ✓ All ${initialMarketCount} markets preserved`);
      console.log(`   ✓ Only ${Object.keys(editedMarkets).length} markets updated`);
      console.log(`   ✓ No unintended changes`);
      console.log('\n   RESULT: Markets persist correctly without loss!');
    } else if (afterMarketCount < initialMarketCount) {
      console.log('❌ UPSERT FAILURE - Markets are being deleted!');
      console.log(`   ✗ Lost ${initialMarketCount - afterMarketCount} markets`);
      console.log('   ✗ Issue: Backend is using DELETE instead of UPDATE');
    } else if (changedCount > 0) {
      console.log('⚠️ PARTIAL ISSUE - Unintended changes detected');
      console.log(`   ✗ ${changedCount} markets changed unexpectedly`);
    } else {
      console.log('✅ MARKETS PERSISTED');
    }
    
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testUpsertBehavior().catch(console.error);
