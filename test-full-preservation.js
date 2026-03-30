/**
 * Full Market Preservation Test
 * Tests with 39 market game to verify upsert preservation
 */

import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'https://server-tau-puce.vercel.app';
const TEST_GAME_ID = '0fbdbffc-18d4-47ac-a6e8-7ce310c47044'; // Game with 39 markets

async function testFullPreservation() {
  try {
    console.log('\n=== FULL MARKET PRESERVATION TEST (39 Markets) ===\n');

    // Step 1: Get baseline
    console.log('1️⃣ Getting baseline state...');
    let res = await fetch(`${API_URL}/api/admin/games`);
    let data = await res.json();
    
    const game = data.games?.find(g => (g.id || g.game_id) === TEST_GAME_ID);
    if (!game) {
      console.log('❌ Test game not found');
      return;
    }

    const initialMarkets = { ...game.markets };
    const initialCount = Object.keys(initialMarkets).length;
    console.log(`✅ Baseline: ${initialCount} markets`);
    console.log(`   Sample keys: ${Object.keys(initialMarkets).slice(0, 5).join(', ')}`);

    // Step 2: Edit only 5 specific markets
    const marketsToEdit = {
      bttsYes: 1.66,
      over25: 1.77,
      doubleChanceHomeOrDraw: 1.48,
      cs10: 7.99,
      cs20: 11.25,
    };

    console.log(`\n2️⃣ Editing only ${Object.keys(marketsToEdit).length} markets...`);
    res = await fetch(`${API_URL}/api/admin/games/${TEST_GAME_ID}/markets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: 'admin@test.com', markets: marketsToEdit })
    });
    data = await res.json();
    console.log(`✅ Save: ${data.marketCount} markets in request`);

    // Step 3: Fetch and verify
    console.log(`\n3️⃣ Verifying after edit...`);
    res = await fetch(`${API_URL}/api/admin/games`);
    data = await res.json();
    
    const updated = data.games.find(g => (g.id || g.game_id) === TEST_GAME_ID);
    const afterCount = Object.keys(updated?.markets || {}).length;

    console.log(`   Final market count: ${afterCount}`);

    if (afterCount !== initialCount) {
      console.log(`   ❌ LOSS DETECTED: ${initialCount} -> ${afterCount} (lost ${initialCount - afterCount})`);
    } else {
      console.log(`   ✅ All ${initialCount} markets preserved!`);
    }

    // Step 4: Detailed validation
    console.log(`\n4️⃣ Detailed validation...`);
    
    let correctEdits = 0;
    let wrongEdits = 0;
    let preservedCorrectly = 0;
    let preservedWrong = 0;
    let lost = 0;

    for (const [key, value] of Object.entries(initialMarkets)) {
      const newValue = updated?.markets?.[key];
      const isEdited = key in marketsToEdit;
      const shouldBe = isEdited ? marketsToEdit[key] : value;

      if (newValue === undefined) {
        lost++;
        if (lost <= 3) console.log(`   ❌ Lost: ${key} (was ${value})`);
      } else if (isEdited) {
        if (parseFloat(newValue) === parseFloat(shouldBe)) {
          correctEdits++;
        } else {
          wrongEdits++;
          console.log(`   ⚠️ Wrong edit: ${key} expected ${shouldBe}, got ${newValue}`);
        }
      } else {
        if (parseFloat(newValue) === parseFloat(value)) {
          preservedCorrectly++;
        } else {
          preservedWrong++;
          console.log(`   ⚠️ Unintended change: ${key} was ${value}, now ${newValue}`);
        }
      }
    }

    // Summary
    console.log(`\n` + '='.repeat(70));
    console.log('RESULTS SUMMARY:');
    console.log(`  Edited correctly: ${correctEdits}/${Object.keys(marketsToEdit).length}`);
    console.log(`  Preserved correctly: ${preservedCorrectly}/${initialCount - Object.keys(marketsToEdit).length}`);
    console.log(`  Lost: ${lost}`);
    console.log(`  Unintended changes: ${preservedWrong + wrongEdits}`);

    if (lost === 0 && correctEdits === Object.keys(marketsToEdit).length && preservedWrong === 0 && wrongEdits === 0) {
      console.log('\n✅ PERFECT: All markets preserved, only edited ones changed!');
      console.log('\nFIX VALIDATED: Market persistence is working correctly!');
      console.log('Users will see consistent market values until admin edits them.');
    } else {
      console.log('\n❌ ISSUES DETECTED');
      if (lost > 0) console.log(`   - ${lost} markets were lost`);
      if (wrongEdits > 0) console.log(`   - ${wrongEdits} edits were incorrect`);
      if (preservedWrong > 0) console.log(`   - ${preservedWrong} markets changed unintentionally`);
    }
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFullPreservation().catch(console.error);
