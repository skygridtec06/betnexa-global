import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error(' Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMarkets() {
  try {
    console.log('\n Checking Markets Database Status...\n');

    // Get total games
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, game_id, home_team, away_team')
      .limit(5);

    if (gamesError) {
      console.error(' Error fetching games:', gamesError.message);
      return;
    }

    console.log( Sample Games (first 5):);
    games?.forEach(g => {
      console.log(  - :  vs );
    });

    // Check if games have markets
    if (games && games.length > 0) {
      const gameIds = games.map(g => g.id);

      console.log(\n Checking for markets for these games...);

      const { data: markets, error: marketsError } = await supabase
        .from('markets')
        .select('game_id, market_key, odds')
        .in('game_id', gameIds);

      if (marketsError) {
        console.error(' Error fetching markets:', marketsError.message);      
        return;
      }

      console.log(\n Markets Status:);
      console.log(  Total market records: );

      if (markets && markets.length > 0) {
        const marketsByGame = {};
        markets.forEach(m => {
          if (!marketsByGame[m.game_id]) {
            marketsByGame[m.game_id] = [];
          }
          marketsByGame[m.game_id].push(${m.market_key}=);
        });

        for (const [gameId, mkt] of Object.entries(marketsByGame)) {
          console.log(\n  Game :);
          console.log(    Markets: );
        }
      } else {
        console.log('    NO MARKETS FOUND IN DATABASE');
      }
    }

    // Check total counts
    const { count: gameCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });

    const { count: marketCount } = await supabase
      .from('markets')
      .select('*', { count: 'exact', head: true });

    console.log(\n Total Counts:);
    console.log(  Games: );
    console.log(  Market records: );

  } catch (error) {
    console.error(' Fatal error:', error.message);
  }
}

checkMarkets();
