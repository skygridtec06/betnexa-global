/**
 * Direct database query test to verify market persistence
 * This bypasses the frontend GET endpoint
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://zpjfdngqcokphyqcohqj.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwamZkbmdxY29rcGh5cWNvaHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTc3NzcxMDcsImV4cCI6MjAzMzM1MzEwN30.8jRJP5nxqZLf3ldpECtX-TN9xA_9XOxpgvQPvGkhjEo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseDirectly() {
  try {
    console.log('\n=== DIRECT DATABASE QUERY TEST ===\n');

    // Get a game
    const { data: games } = await supabase.from('games').select('id, home_team, away_team').limit(1);
    if (!games || games.length === 0) {
      console.log('❌ No games found');
      return;
    }

    const game = games[0];
    const gameId = game.id;

    console.log(`Game: ${game.home_team} vs ${game.away_team}`);
    console.log(`GameID: ${gameId}\n`);

    // Query markets directly
    console.log('Querying markets table directly...');
    const { data: allMarkets, error: err } = await supabase
      .from('markets')
      .select('market_key, odds')
      .eq('game_id', gameId);

    if (err) {
      console.log(`❌ Query error: ${err.message}`);
      return;
    }

    console.log(`\n📊 Total markets in database: ${allMarkets?.length || 0}`);
    
    if (allMarkets && allMarkets.length > 0) {
      console.log('\nMarket keys:');
      allMarkets.slice(0, 20).forEach(m => {
        console.log(`  - ${m.market_key}: ${m.odds}`);
      });
      
      if (allMarkets.length > 20) {
        console.log(`  ... and ${allMarkets.length - 20} more`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDatabaseDirectly().catch(console.error);
