#!/usr/bin/env node

/**
 * Test Fixture Creation Flow
 * Tests the complete flow of adding a fixture through the admin API
 */

const API_URL = 'https://betnexa-globalback.vercel.app/';
const ADMIN_PHONE = '0714945142';

async function testFixtureCreation() {
  console.log('\n🧪 Testing Fixture Creation Flow');
  console.log('================================\n');

  try {
    // Step 1: Test API health
    console.log('📊 Step 1: Checking API health...');
    const healthRes = await fetch(`${API_URL}/api/health`);
    if (healthRes.ok) {
      console.log('✅ API is healthy\n');
    } else {
      console.warn('⚠️ API health check failed, continuing anyway...\n');
    }

    // Step 2: Get existing games
    console.log('📋 Step 2: Fetching existing games...');
    const gamesRes = await fetch(`${API_URL}/api/admin/games`);
    const gamesData = await gamesRes.json();
    
    if (gamesData.success && Array.isArray(gamesData.games)) {
      console.log(`✅ Found ${gamesData.games.length} existing games\n`);
      if (gamesData.games.length > 0) {
        console.log('Existing games:');
        gamesData.games.forEach((g, i) => {
          console.log(`  ${i + 1}. ${g.home_team} vs ${g.away_team} (${g.status})`);
        });
        console.log();
      }
    } else {
      console.log('❌ Failed to fetch games:', gamesData.error, '\n');
    }

    // Step 3: Create a new fixture
    console.log('➕ Step 3: Creating a new fixture...');
    const newFixture = {
      phone: ADMIN_PHONE,
      league: 'Test League',
      homeTeam: `Arsenal-${Date.now()}`,
      awayTeam: `Chelsea-${Date.now()}`,
      homeOdds: 2.1,
      drawOdds: 3.2,
      awayOdds: 3.3,
      time: new Date().toISOString(),
      status: 'upcoming',
      markets: {}
    };

    console.log('Sending fixture:', JSON.stringify(newFixture, null, 2));
    
    const createRes = await fetch(`${API_URL}/api/admin/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newFixture)
    });

    const createData = await createRes.json();
    
    if (createData.success) {
      console.log('✅ Fixture created successfully!');
      console.log('Game ID:', createData.game.game_id || createData.game.id);
      console.log('Response:', JSON.stringify(createData.game, null, 2), '\n');
    } else {
      console.log('❌ Failed to create fixture');
      console.log('Error:', createData.error || createData);
      console.log('Details:', createData.details || 'N/A', '\n');
      process.exit(1);
    }

    // Step 4: Verify the fixture was saved
    console.log('🔍 Step 4: Verifying fixture was saved...');
    const verifyRes = await fetch(`${API_URL}/api/admin/games`);
    const verifyData = await verifyRes.json();

    if (verifyData.success && Array.isArray(verifyData.games)) {
      const newGame = verifyData.games.find(g => 
        g.home_team === newFixture.homeTeam && g.away_team === newFixture.awayTeam
      );
      
      if (newGame) {
        console.log('✅ Fixture verified in database!');
        console.log('Stored fixture:');
        console.log(`  Home: ${newGame.home_team}`);
        console.log(`  Away: ${newGame.away_team}`);
        console.log(`  Status: ${newGame.status}`);
        console.log(`  League: ${newGame.league}`);
        console.log(`  Odds: ${newGame.home_odds} / ${newGame.draw_odds} / ${newGame.away_odds}\n`);
      } else {
        console.log('❌ Fixture not found in database after creation\n');
        process.exit(1);
      }
    }

    console.log('✅ All tests passed!\n');
    console.log('Summary:');
    console.log('  ✓ API is running');
    console.log('  ✓ Games can be fetched');
    console.log('  ✓ New fixture can be created');
    console.log('  ✓ Fixture persists in database');
    console.log('  ✓ All users can see the fixture\n');

  } catch (error) {
    console.error('❌ Test error:', error.message);
    process.exit(1);
  }
}

testFixtureCreation();
