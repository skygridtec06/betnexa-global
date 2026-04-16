#!/usr/bin/env node
/**
 * Quick diagnostic to check if markets exist in the database
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  try {
    // Count games
    const { count: gameCount, error: gameErr } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });

    if (gameErr) {
      console.error('❌ Error counting games:', gameErr.message);
    } else {
      console.log(`✅ Total games in DB: ${gameCount}`);
    }

    // Count markets
    const { count: marketCount, error: marketErr } = await supabase
      .from('markets')
      .select('*', { count: 'exact', head: true });

    if (marketErr) {
      console.error('❌ Error counting markets:', marketErr.message);
    } else {
      console.log(`✅ Total market records in DB: ${marketCount}`);
    }

    // Get a sample game and check if it has markets
    if ((gameCount || 0) > 0) {
      const { data: sampleGame } = await supabase
        .from('games')
        .select('id, game_id, home_team, away_team')
        .limit(1)
        .single();

      if (sampleGame) {
        console.log(`\n📋 Sample Game: ${sampleGame.home_team} vs ${sampleGame.away_team}`);
        console.log(`   UUID: ${sampleGame.id}`);
        console.log(`   Game ID: ${sampleGame.game_id}`);

        // Check markets for this game
        const { data: gameMarkets, count: marketCount } = await supabase
          .from('markets')
          .select('market_key, odds', { count: 'exact' })
          .eq('game_id', sampleGame.id);

        if (gameMarkets && gameMarkets.length > 0) {
          console.log(`\n   ✅ Has ${gameMarkets.length} market records:`);
          gameMarkets.slice(0, 5).forEach(m => {
            console.log(`      - ${m.market_key}: ${m.odds}`);
          });
        } else {
          console.log(`\n   ⚠️  NO markets found for this game!`);
        }
      }
    }

    console.log('\n=== DIAGNOSIS COMPLETE ===');
    if (gameCount === 0) {
      console.error('❌ CRITICAL: No games in database');
    } else if (marketCount === 0) {
      console.error('❌ CRITICAL: No markets in database - games exist but have no odds');
    } else {
      console.log('✅ Games and markets exist - issue may be in frontend/API layer');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  }
}

diagnose();
