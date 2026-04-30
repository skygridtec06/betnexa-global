/**
 * Find a game with many markets and test preservation
 */

import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'https://betnexa-globalback.vercel.app';

async function findGameWithManyMarkets() {
  try {
    console.log('\n=== FINDING GAMES WITH MANY MARKETS ===\n');

    const res = await fetch(`${API_URL}/api/admin/games`);
    const data = await res.json();
    
    const games = data.games?.sort((a, b) => {
      const countA = Object.keys(a.markets || {}).length;
      const countB = Object.keys(b.markets || {}).length;
      return countB - countA; // Descending
    }) || [];

    if (games.length === 0) {
      console.log('❌ No games found');
      return;
    }

    console.log('Top 10 games by market count:\n');
    games.slice(0, 10).forEach((game, i) => {
      const marketCount = Object.keys(game.markets || {}).length;
      const isManual = !String(game.id || game.game_id).startsWith('af-');
      const isApiManaged = String(game.id || game.game_id).startsWith('af-');
      
      const marketList = Object.keys(game.markets || {}).slice(0, 3).join(', ');
      
      console.log(`${i + 1}. ${game.home_team || '?'} vs ${game.away_team || '?'}`);
      console.log(`   Markets: ${marketCount}`);
      console.log(`   Type: ${isManual ? 'Manual' : 'API-managed'}`);
      console.log(`   Sample: ${marketList}`);
      console.log(`   ID: ${game.id || game.game_id}\n`);
    });

    const manualGameWithMarkets = games.find(g => {
      const isManual = !String(g.id || g.game_id).startsWith('af-');
      const hasMarkets = Object.keys(g.markets || {}).length > 10;
      return isManual && hasMarkets;
    });

    if (manualGameWithMarkets) {
      console.log(`✅ Found ideal test game with ${Object.keys(manualGameWithMarkets.markets || {}).length} markets!`);
      console.log(`   ID: ${manualGameWithMarkets.id || manualGameWithMarkets.game_id}`);
      return manualGameWithMarkets.id || manualGameWithMarkets.game_id;
    } else {
      console.log('⚠️ No manual game with >10 markets found');
      const manualGame = games.find(g => !String(g.id || g.game_id).startsWith('af-'));
      if (manualGame) {
        console.log(`   Using game with ${Object.keys(manualGame.markets || {}).length} markets instead`);
        return manualGame.id || manualGame.game_id;
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findGameWithManyMarkets().catch(console.error);
