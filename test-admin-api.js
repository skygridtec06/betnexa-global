const fetch = (url, options) => import('node-fetch').then(({default: fetch}) => fetch(url, options));

const API_URL = 'https://betnexa-globalback.vercel.app/';
const ADMIN_PHONE = '0714945142';

async function testAdminAPIs() {
  console.log('🧪 Testing Admin API Endpoints\n');

  try {
    // Test 1: Add a new game
    console.log('1️⃣ Testing POST /api/admin/games...');
    const addGameResponse = await fetch(`${API_URL}/api/admin/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: ADMIN_PHONE,
        league: 'Test League',
        homeTeam: 'Test Home Team',
        awayTeam: 'Test Away Team',
        homeOdds: 2.5,
        drawOdds: 3.0,
        awayOdds: 2.8,
        time: new Date().toISOString(),
        status: 'upcoming',
        markets: {}
      })
    });

    const addGameData = await addGameResponse.json();
    if (addGameData.success) {
      console.log('✅ Game added successfully!');
      console.log('   Game ID:', addGameData.game.game_id);
      const gameId = addGameData.game.game_id;

      // Test 2: Get all games
      console.log('\n2️⃣ Testing GET /api/admin/games...');
      const getGamesResponse = await fetch(`${API_URL}/api/admin/games`);
      const getGamesData = await getGamesResponse.json();
      if (getGamesData.success) {
        console.log('✅ Games retrieved successfully!');
        console.log('   Total games:', getGamesData.games.length);
      } else {
        console.log('❌ Failed to get games:', getGamesData.error);
      }

      // Test 3: Update game score
      console.log('\n3️⃣ Testing PUT /api/admin/games/:id/score...');
      const updateScoreResponse = await fetch(`${API_URL}/api/admin/games/${gameId}/score`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: ADMIN_PHONE,
          homeScore: 2,
          awayScore: 1,
          minute: 45,
          status: 'live'
        })
      });

      const updateScoreData = await updateScoreResponse.json();
      if (updateScoreData.success) {
        console.log('✅ Score updated successfully!');
        console.log('   Home Score:', updateScoreData.game.home_score);
        console.log('   Away Score:', updateScoreData.game.away_score);
      } else {
        console.log('❌ Failed to update score:', updateScoreData.error);
      }

      // Test 4: Update game markets
      console.log('\n4️⃣ Testing PUT /api/admin/games/:id/markets...');
      const markets = {
        over25: 1.8,
        under25: 2.0,
        bttsYes: 1.9,
        bttsNo: 1.95
      };
      const updateMarketsResponse = await fetch(`${API_URL}/api/admin/games/${gameId}/markets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: ADMIN_PHONE,
          markets
        })
      });

      const updateMarketsData = await updateMarketsResponse.json();
      if (updateMarketsData.success) {
        console.log('✅ Markets updated successfully!');
      } else {
        console.log('❌ Failed to update markets:', updateMarketsData.error);
      }

      // Test 5: Get admin stats
      console.log('\n5️⃣ Testing GET /api/admin/stats...');
      const statsResponse = await fetch(`${API_URL}/api/admin/stats`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      const statsData = await statsResponse.json();
      if (statsData.success) {
        console.log('✅ Stats retrieved successfully!');
        console.log('   Total Users:', statsData.stats.totalUsers);
        console.log('   Total Games:', statsData.stats.totalGames);
        console.log('   Total Bets:', statsData.stats.totalBets);
        console.log('   Pending Payments:', statsData.stats.pendingPayments);
      } else {
        console.log('❌ Failed to get stats:', statsData.error);
      }

      // Test 6: Delete the test game
      console.log('\n6️⃣ Testing DELETE /api/admin/games/:id...');
      const deleteGameResponse = await fetch(`${API_URL}/api/admin/games/${gameId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: ADMIN_PHONE
        })
      });

      const deleteGameData = await deleteGameResponse.json();
      if (deleteGameData.success) {
        console.log('✅ Game deleted successfully!');
      } else {
        console.log('❌ Failed to delete game:', deleteGameData.error);
      }
    } else {
      console.log('❌ Failed to add game:', addGameData.error);
    }

    console.log('\n✅ All tests completed!\n');
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
  }
}

testAdminAPIs();
