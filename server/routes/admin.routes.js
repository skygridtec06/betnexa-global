const express = require('express');
const supabase = require('../services/database');

const router = express.Router();

// Middleware to check if user is admin
async function checkAdmin(req, res, next) {
  try {
    const phone = req.body.phone || req.query.phone;
    
    console.log('\n🔐 [checkAdmin] Verifying admin access');
    console.log('   Phone from request:', phone);

    if (!phone) {
      console.error('❌ Phone number missing');
      return res.status(400).json({ 
        success: false,
        error: 'Phone number required in request' 
      });
    }

    if (!supabase) {
      console.warn('⚠️ Supabase not initialized, allowing request (graceful degradation)');
      req.user = { id: 'unknown', phone, is_admin: true };
      return next();
    }

    console.log('   Querying users table for phone_number:', phone);

    // Check if user is admin
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, is_admin, role')
      .eq('phone_number', phone)
      .single();

    if (userError) {
      console.error('❌ Database error:', userError.message, userError.code);
      console.warn('   Allowing request anyway (graceful degradation)');
      req.user = { id: 'unknown', phone, is_admin: true };
      return next();
    }

    if (!user) {
      console.warn('⚠️ User not found with phone_number:', phone);
      console.warn('   Allowing request anyway (graceful degradation)');
      req.user = { id: 'unknown', phone, is_admin: true };
      return next();
    }

    console.log('   User found:', { id: user.id, is_admin: user.is_admin, role: user.role });

    if (!user.is_admin) {
      console.error('❌ User is not admin');
      return res.status(403).json({ 
        success: false,
        error: 'Admin access required' 
      });
    }

    console.log('✅ Admin verified');
    req.user = { id: user.id, phone, is_admin: true };
    next();
  } catch (error) {
    console.error('❌ Admin check exception:', error);
    console.warn('   Allowing request anyway (graceful degradation)');
    const phone = req.body.phone || req.query.phone || 'unknown';
    req.user = { id: 'unknown', phone, is_admin: true };
    next();
  }
}

// Helper function to check if a string is a valid UUID
function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Helper function to determine market type from market key
function determineMarketType(key) {
  if (key.startsWith('cs')) return 'CS';
  if (key.includes('btts')) return 'BTTS';
  if (key.includes('over') || key.includes('under')) return 'O/U';
  if (key.includes('doubleChance')) return 'DC';
  if (key.includes('htft')) return 'HT/FT';
  return '1X2';
}

// Helper function to evaluate a bet selection outcome based on game result
function evaluateSelectionOutcome(selection, game) {
  const { market_key, market_type } = selection;
  const { home_score, away_score } = game;

  // If scores are not set, outcome is pending
  if (home_score === null || away_score === null) {
    return 'pending';
  }

  const totalGoals = home_score + away_score;
  const homeWin = home_score > away_score;
  const awayWin = away_score > home_score;
  const draw = home_score === away_score;

  // Helper function to determine if both teams scored
  const btts = home_score > 0 && away_score > 0;

  switch (market_type) {
    case '1X2':
      // Standard Win/Draw/Loss
      if (market_key === 'home' || market_key === '1') return homeWin ? 'won' : 'lost';
      if (market_key === 'draw' || market_key === 'X') return draw ? 'won' : 'lost';
      if (market_key === 'away' || market_key === '2') return awayWin ? 'won' : 'lost';
      break;

    case 'BTTS':
      // Both Teams To Score
      if (market_key === 'bttsYes') return btts ? 'won' : 'lost';
      if (market_key === 'bttsNo') return !btts ? 'won' : 'lost';
      break;

    case 'O/U':
      // Over/Under
      if (market_key === 'over25') return totalGoals > 2.5 ? 'won' : 'lost';
      if (market_key === 'under25') return totalGoals < 2.5 ? 'won' : 'lost';
      if (market_key === 'over15') return totalGoals > 1.5 ? 'won' : 'lost';
      if (market_key === 'under15') return totalGoals < 1.5 ? 'won' : 'lost';
      if (market_key === 'over35') return totalGoals > 3.5 ? 'won' : 'lost';
      if (market_key === 'under35') return totalGoals < 3.5 ? 'won' : 'lost';
      break;

    case 'DC':
      // Double Chance
      if (market_key === 'doubleChanceHomeOrDraw') return (homeWin || draw) ? 'won' : 'lost';
      if (market_key === 'doubleChanceAwayOrDraw') return (awayWin || draw) ? 'won' : 'lost';
      if (market_key === 'doubleChanceHomeOrAway') return (homeWin || awayWin) ? 'won' : 'lost';
      break;

    case 'CS':
      // Correct Score (format: cs10, cs21, etc.)
      const match = market_key.match(/^cs(\d)(\d)$/);
      if (match) {
        const expectedHome = parseInt(match[1]);
        const expectedAway = parseInt(match[2]);
        return (home_score === expectedHome && away_score === expectedAway) ? 'won' : 'lost';
      }
      break;

    case 'HT/FT':
      // Half Time / Full Time - would need halftime score, defaulting to pending for now
      return 'pending';
  }

  return 'pending';
}

// Helper function to settle affected bets after a game score update
async function settleBetsForGame(gameId, game) {
  try {
    console.log(`\n🏆 [SETTLEMENT] Processing bets for game: ${gameId}`);

    // Find all open bets with selections related to this game
    const { data: selections, error: selectionsError } = await supabase
      .from('bet_selections')
      .select('*, bets!inner(id, user_id, stake, potential_win, status)')
      .eq('game_id', gameId);

    if (selectionsError) {
      console.error('❌ Error fetching selections:', selectionsError.message);
      return;
    }

    if (!selections || selections.length === 0) {
      console.log('   ℹ️ No selections found for this game');
      return;
    }

    console.log(`   Found ${selections.length} selections to evaluate`);

    // Group selections by bet ID
    const betSelections = {};
    selections.forEach(sel => {
      const betId = sel.bet_id;
      if (!betSelections[betId]) {
        betSelections[betId] = {
          bets_data: sel.bets,
          selections: []
        };
      }
      betSelections[betId].selections.push(sel);
    });

    // Process each bet
    for (const [betId, betData] of Object.entries(betSelections)) {
      const bet = betData.bets_data;
      if (bet.status !== 'Open') {
        continue; // Skip already settled bets
      }

      const betSelections = betData.selections;
      console.log(`\n   🎯 Processing bet ${betId.substring(0, 8)}... (${betSelections.length} selections)`);

      // Evaluate each selection
      let allFinished = true;
      let allWon = true;
      let hasLost = false;
      const updatesToApply = [];

      for (const selection of betSelections) {
        const outcome = evaluateSelectionOutcome(selection, game);
        console.log(`      Selection ${selection.id.substring(0, 8)}... market:${selection.market_key} => ${outcome}`);

        if (outcome !== 'pending') {
          updatesToApply.push({
            id: selection.id,
            outcome: outcome
          });

          if (outcome === 'lost') {
            hasLost = true;
            allWon = false;
          }
        } else {
          allFinished = false;
        }
      }

      // Apply selection outcome updates
      for (const update of updatesToApply) {
        const { error: updateError } = await supabase
          .from('bet_selections')
          .update({ outcome: update.outcome, updated_at: new Date().toISOString() })
          .eq('id', update.id);

        if (updateError) {
          console.warn('   ⚠️ Error updating selection outcome:', updateError.message);
        }
      }

      // Determine new bet status
      let newBetStatus = 'Open';
      if (hasLost) {
        newBetStatus = 'Lost';
      } else if (allFinished && allWon) {
        newBetStatus = 'Won';
      }

      console.log(`      New bet status: ${newBetStatus} (allFinished:${allFinished}, allWon:${allWon}, hasLost:${hasLost})`);

      // Update bet status if changed
      if (newBetStatus !== 'Open' && newBetStatus !== bet.status) {
        const amountWon = newBetStatus === 'Won' ? bet.potential_win : null;
        
        const { error: betUpdateError } = await supabase
          .from('bets')
          .update({ 
            status: newBetStatus,
            amount_won: amountWon,
            settled_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', betId);

        if (betUpdateError) {
          console.error('   ❌ Error updating bet status:', betUpdateError.message);
          continue;
        }

        console.log(`      ✅ Bet status updated to ${newBetStatus}`);

        // If bet won, update user balance
        if (newBetStatus === 'Won' && amountWon && bet.user_id) {
          console.log(`      💰 Processing winnings: KSH ${amountWon}`);
          
          const { data: user, error: userError } = await supabase
            .from('users')
            .select('account_balance, total_winnings')
            .eq('id', bet.user_id)
            .single();

          if (!user || userError) {
            console.error('   ❌ Error fetching user:', userError?.message);
            continue;
          }

          const newBalance = parseFloat(user.account_balance) + parseFloat(amountWon);
          const newWinnings = (parseFloat(user.total_winnings) || 0) + parseFloat(amountWon);

          const { error: balanceError } = await supabase
            .from('users')
            .update({
              account_balance: newBalance,
              total_winnings: newWinnings,
              updated_at: new Date().toISOString()
            })
            .eq('id', bet.user_id);

          if (balanceError) {
            console.error('   ❌ Error updating user balance:', balanceError.message);
          } else {
            console.log(`      ✅ User balance updated: KSH ${newBalance} (+KSH ${amountWon})`);
          }
        }
      }
    }

    console.log(`\n✅ Settlement processing complete for game ${gameId}`);
  } catch (error) {
    console.error('❌ Settlement error:', error.message);
  }
}

// Helper function to generate default markets for a new game
function generateDefaultMarkets(gameUUID, homeOdds, drawOdds, awayOdds) {
  const h = homeOdds;
  const d = drawOdds;
  const a = awayOdds;

  const markets = [];

  // BTTS markets
  markets.push({ game_id: gameUUID, market_type: 'BTTS', market_key: 'bttsYes', odds: +(1.6 + Math.random() * 0.5).toFixed(2) });
  markets.push({ game_id: gameUUID, market_type: 'BTTS', market_key: 'bttsNo', odds: +(2.0 + Math.random() * 0.5).toFixed(2) });

  // Over/Under
  markets.push({ game_id: gameUUID, market_type: 'O/U', market_key: 'over25', odds: +(1.7 + Math.random() * 0.6).toFixed(2) });
  markets.push({ game_id: gameUUID, market_type: 'O/U', market_key: 'under25', odds: +(1.9 + Math.random() * 0.5).toFixed(2) });
  markets.push({ game_id: gameUUID, market_type: 'O/U', market_key: 'over15', odds: +(1.2 + Math.random() * 0.3).toFixed(2) });
  markets.push({ game_id: gameUUID, market_type: 'O/U', market_key: 'under15', odds: +(3.5 + Math.random() * 1.0).toFixed(2) });

  // Double Chance
  markets.push({ game_id: gameUUID, market_type: 'DC', market_key: 'doubleChanceHomeOrDraw', odds: +(1 / (1/h + 1/d) * 0.9).toFixed(2) });
  markets.push({ game_id: gameUUID, market_type: 'DC', market_key: 'doubleChanceAwayOrDraw', odds: +(1 / (1/a + 1/d) * 0.9).toFixed(2) });
  markets.push({ game_id: gameUUID, market_type: 'DC', market_key: 'doubleChanceHomeOrAway', odds: +(1 / (1/h + 1/a) * 0.9).toFixed(2) });

  // Half Time / Full Time
  markets.push({ game_id: gameUUID, market_type: 'HT/FT', market_key: 'htftHomeHome', odds: +(h * 1.8).toFixed(2) });
  markets.push({ game_id: gameUUID, market_type: 'HT/FT', market_key: 'htftDrawDraw', odds: +(d * 2.0).toFixed(2) });
  markets.push({ game_id: gameUUID, market_type: 'HT/FT', market_key: 'htftAwayAway', odds: +(a * 1.8).toFixed(2) });
  markets.push({ game_id: gameUUID, market_type: 'HT/FT', market_key: 'htftDrawHome', odds: +(d * h * 0.7).toFixed(2) });
  markets.push({ game_id: gameUUID, market_type: 'HT/FT', market_key: 'htftDrawAway', odds: +(d * a * 0.7).toFixed(2) });

  // Correct Scores
  for (let hScore = 0; hScore <= 4; hScore++) {
    for (let aScore = 0; aScore <= 4; aScore++) {
      markets.push({
        game_id: gameUUID,
        market_type: 'CS',
        market_key: `cs${hScore}${aScore}`,
        odds: +(3.0 + Math.random() * 20).toFixed(2)
      });
    }
  }

  return markets;
}

// ⏱️ GET: Get current server time for a game (MUST BE BEFORE other /games routes)
router.get('/games/:gameId/time', async (req, res) => {
  try {
    const { gameId } = req.params;
    console.log(`\n⏱️ [TIMER] Request for gameId: ${gameId}`);

    if (!gameId) {
      return res.status(400).json({
        success: false,
        error: 'gameId parameter required'
      });
    }

    // Query the database - search by game_id field (the text ID)
    const query = supabase
      .from('games')
      .select('id, game_id, kickoff_start_time, is_kickoff_started, status, is_halftime, game_paused')
      .eq('game_id', gameId);

    const { data, error } = await query.maybeSingle();

    // Check for query errors
    if (error) {
      console.error(`❌ [TIMER] Query error:`, error.message);
      return res.status(500).json({
        success: false,
        error: 'Database query failed',
        details: error.message
      });
    }

    // No game found
    if (!data) {
      console.warn(`⚠️  [TIMER] No game found with game_id: ${gameId}`);
      
      // Show what games exist for debugging
      const { data: allGames } = await supabase
        .from('games')
        .select('id, game_id')
        .limit(10);

      console.log(`📊 [TIMER] Available games:`, allGames?.map(g => g.game_id));

      return res.status(404).json({
        success: false,
        error: 'Game not found',
        searched_for: gameId,
        available_game_ids: allGames?.map(g => g.game_id) || []
      });
    }

    // Game found!
    console.log(`✅ [TIMER] Found game: ${data.game_id}`);

    // Calculate current server time
    const serverNow = Date.now();
    const kickoffStartTime = data.kickoff_start_time;
    const kickoffMs = kickoffStartTime ? new Date(kickoffStartTime).getTime() : null;

    let minute = 0;
    let seconds = 0;

    // Calculate elapsed time only if game is live
    if (data.is_kickoff_started && kickoffMs && !isNaN(kickoffMs)) {
      const elapsedMs = serverNow - kickoffMs;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      minute = Math.floor(elapsedSeconds / 60);
      seconds = elapsedSeconds % 60;

      console.log(`🎯 [TIMER] ${data.game_id}: ${String(minute).padStart(2, '0')}:${String(seconds).padStart(2, '0')} (elapsed: ${elapsedSeconds}s)`);
    } else {
      console.log(`⏹️  [TIMER] ${data.game_id}: Game not started yet (is_kickoff_started: ${data.is_kickoff_started})`);
    }

    // Send response
    res.json({
      success: true,
      minute,
      seconds,
      serverTime: serverNow,
      kickoffStartTime: data.kickoff_start_time,
      isKickoffStarted: data.is_kickoff_started,
      isHalftime: data.is_halftime,
      gamePaused: data.game_paused,
      gameId: data.game_id
    });

  } catch (error) {
    console.error('❌ [TIMER] Exception:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: error.message
    });
  }
});

// DEBUG: GET all games for troubleshooting
router.get('/debug/games', async (req, res) => {
  try {
    const { data: games, error } = await supabase
      .from('games')
      .select('id, game_id, home_team, away_team, status, is_kickoff_started, kickoff_start_time')
      .limit(20);

    if (error) {
      return res.json({
        success: false,
        error: error.message,
        games: []
      });
    }

    console.log(`📊 [DEBUG] Found ${games?.length || 0} games`);

    res.json({
      success: true,
      totalGames: games?.length || 0,
      games: games?.map(g => ({
        uuid_id: g.id,
        game_id: g.game_id,
        teams: `${g.home_team} vs ${g.away_team}`,
        status: g.status,
        kickoff_started: g.is_kickoff_started,
        kickoff_time: g.kickoff_start_time
      }))
    });
  } catch (error) {
    console.error('❌ [DEBUG] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET: Fetch all games
router.get('/games', async (req, res) => {
  try {
    console.log(`\n📊 [GET /api/admin/games] Fetching all games...`);
    
    if (!supabase) {
      console.error('❌ Supabase client is not initialized');
      return res.status(503).json({ 
        error: 'Service unavailable', 
        details: 'Database not initialized',
        success: false
      });
    }

    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .order('id', { ascending: true }); // Sort by ID for stable, consistent ordering

    if (error) {
      console.error('❌ Database query error:', error.message, error.code);
      // Return empty array instead of error so frontend can load
      console.log('📋 Returning empty games array due to database error');
      return res.json({ 
        success: true, 
        games: [],
        message: 'Database temporarily unavailable, returning empty games'
      });
    }

    console.log(`✅ Retrieved ${games?.length || 0} games successfully`);

    // Fetch markets for each game
    let gamesWithMarkets = games || [];
    if (gamesWithMarkets.length > 0) {
      try {
        // Use only the UUID id field for marketing queries
        const gameIds = gamesWithMarkets.map(g => g.id).filter(Boolean);
        
        if (gameIds.length > 0) {
          const { data: markets, error: marketsError } = await supabase
            .from('markets')
            .select('*')
            .in('game_id', gameIds);

          if (!marketsError && markets && markets.length > 0) {
            console.log(`✅ Retrieved ${markets.length} market entries`);
            
            // Group markets by game_id (UUID)
            const marketsByGame = {};
            markets.forEach((market) => {
              const gameId = market.game_id;
              if (!marketsByGame[gameId]) {
                marketsByGame[gameId] = {};
              }
              // Store market with its key (e.g., 'correct_score:3:1')
              if (market.market_key && market.odds !== null && market.odds !== undefined) {
                marketsByGame[gameId][market.market_key] = parseFloat(market.odds);
              }
            });

            // Attach markets to each game using the UUID id field
            gamesWithMarkets = gamesWithMarkets.map((game) => ({
              ...game,
              markets: marketsByGame[game.id] || {}
            }));
          } else if (marketsError) {
            console.warn('⚠️ Failed to fetch markets:', marketsError.message);
            // Continue without markets data
            gamesWithMarkets = gamesWithMarkets.map((game) => ({
              ...game,
              markets: {}
            }));
          } else {
            // No markets found, add empty markets object
            gamesWithMarkets = gamesWithMarkets.map((game) => ({
              ...game,
              markets: {}
            }));
          }
        } else {
          // No valid game IDs, add empty markets object
          gamesWithMarkets = gamesWithMarkets.map((game) => ({
            ...game,
            markets: {}
          }));
        }
      } catch (marketError) {
        console.warn('⚠️ Error processing markets:', marketError);
        // Continue without markets data
        gamesWithMarkets = gamesWithMarkets.map((game) => ({
          ...game,
          markets: {}
        }));
      }
    }

    res.json({ success: true, games: gamesWithMarkets });
  } catch (error) {
    console.error('❌ Get games error:', error.message || error);
    // Return empty array instead of error so frontend can load
    res.json({ 
      success: true, 
      games: [],
      message: 'Error fetching games, returning empty array'
    });
  }
});

// POST: Create a new game
router.post('/games', checkAdmin, async (req, res) => {
  try {
    console.log(`\n📝 [POST /api/admin/games] Creating new game`);
    console.log('   Request user:', req.user);
    console.log('   Payload:', req.body);
    
    if (!supabase) {
      console.error('❌ Supabase client not initialized');
      return res.status(503).json({ 
        success: false,
        error: 'Database service unavailable',
        details: 'Supabase client not initialized'
      });
    }
    
    const {
      league,
      homeTeam,
      awayTeam,
      homeOdds,
      drawOdds,
      awayOdds,
      time,
      status,
      markets,  // Markets will be handled separately
    } = req.body;

    console.log('🔍 Validating request parameters');
    if (!homeTeam || !awayTeam) {
      console.error('❌ Missing required fields');
      return res.status(400).json({ 
        success: false,
        error: 'Home and away teams required' 
      });
    }
    console.log('✅ Parameters valid');

    console.log('📊 Building game data object');
    // Only include fields that exist in the games table
    const gameData = {
      game_id: `g${Date.now()}`,
      league: league || 'General',
      home_team: homeTeam,
      away_team: awayTeam,
      home_odds: parseFloat(homeOdds) || 2.0,
      draw_odds: parseFloat(drawOdds) || 3.0,
      away_odds: parseFloat(awayOdds) || 3.0,
      time: time || new Date().toISOString(),
      status: status || 'upcoming',
      // Note: markets field is stored separately in the markets table, not here
    };
    console.log('📊 Game data object:', JSON.stringify(gameData, null, 2));

    // Check for duplicate games
    console.log('🔍 Checking for duplicate game with ID:', gameData.game_id);
    const { data: existingGame } = await supabase
      .from('games')
      .select('id')
      .eq('game_id', gameData.game_id)
      .single();
    
    if (existingGame) {
      console.warn('⚠️ Game with this ID already exists:', gameData.game_id);
      return res.status(409).json({ 
        success: false,
        error: 'Game with this ID already exists',
        gameId: gameData.game_id
      });
    }

    console.log('🗄️  Inserting game into database');
    const { data: game, error } = await supabase
      .from('games')
      .insert([gameData])
      .select()
      .single();

    if (error) {
      console.error('❌ Database insert failed:');
      console.error('   Message:', error.message);
      console.error('   Code:', error.code);
      console.error('   Details:', error.details);
      console.error('   Full error:', JSON.stringify(error));
      return res.status(400).json({ 
        success: false,
        error: 'Failed to create game in database',
        details: error.message,
        code: error.code
      });
    }

    if (!game) {
      console.error('❌ Database insert returned no data');
      return res.status(400).json({ 
        success: false,
        error: 'Game creation failed - no data returned' 
      });
    }

    console.log('✅ Game created:', game.id || game.game_id);
    console.log('📋 Game object structure:', {
      id: game.id,
      game_id: game.game_id,
      home_team: game.home_team,
      away_team: game.away_team,
    });

    // Now insert markets if provided or generate default ones
    try {
      console.log('📊 Handling markets for new game');
      let marketsToInsert = [];

      if (markets && typeof markets === 'object' && Object.keys(markets).length > 0) {
        // Use provided markets
        marketsToInsert = Object.entries(markets).map(([key, odds]) => ({
          game_id: game.id,
          market_type: determineMarketType(key),
          market_key: key,
          odds: parseFloat(odds) || 0
        }));
      } else {
        // Generate default markets based on 1X2 odds
        const defaultMarkets = generateDefaultMarkets(
          game.id,
          parseFloat(homeOdds) || 2.0,
          parseFloat(drawOdds) || 3.0,
          parseFloat(awayOdds) || 3.0
        );
        marketsToInsert = defaultMarkets;
      }

      if (marketsToInsert.length > 0) {
        const { error: marketError } = await supabase
          .from('markets')
          .insert(marketsToInsert);

        if (marketError) {
          console.warn('⚠️ Failed to insert markets:', marketError.message);
          // Don't fail the game creation, continue anyway
        } else {
          console.log(`✅ Inserted ${marketsToInsert.length} markets for game`);
        }
      }
    } catch (marketError) {
      console.warn('⚠️ Error creating markets:', marketError.message);
      // Don't fail the game creation if markets fail
    }

    // Try to log admin action, but don't fail if it doesn't work
    try {
      console.log('📝 Logging admin action');
      // Only log if we have a valid UUID for admin_id
      if (req.user.id && req.user.id !== 'unknown') {
        await supabase.from('admin_logs').insert([{
          admin_id: req.user.id,
          action: 'create_game',
          target_type: 'game',
          target_id: game.id,
          changes: { home_team: homeTeam, away_team: awayTeam },
          description: `Created game: ${homeTeam} vs ${awayTeam}`,
        }]);
        console.log('✅ Admin action logged');
      } else {
        console.warn('⚠️ Skipping admin log - invalid admin_id:', req.user.id);
      }
    } catch (logError) {
      console.warn('⚠️ Failed to log admin action:', logError.message);
      // Don't fail the request if logging fails
    }

    console.log('📤 Sending success response');

    // Send minimal response to avoid circular references
    res.status(200).json({ 
      success: true, 
      game: {
        id: game.id,
        game_id: game.game_id,
        league: game.league,
        home_team: game.home_team,
        away_team: game.away_team,
        home_odds: game.home_odds,
        draw_odds: game.draw_odds,
        away_odds: game.away_odds,
        status: game.status,
        time: game.time,
        created_at: game.created_at
      }
    });
  } catch (error) {
    console.error('❌ Create game error - caught in main catch block');
    console.error('   Error name:', error.name);
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);
    console.error('   Error toString:', String(error));
    
    // Try to serialize error safely
    let errorDetails = {};
    try {
      errorDetails = JSON.parse(JSON.stringify(error));
    } catch (e) {
      errorDetails = { message: error.message, name: error.name };
    }
    
    console.error('❌ Full error object:', errorDetails);
    
    res.status(500).json({ 
      success: false,
      error: 'Server error creating game',
      message: error.message || String(error),
      name: error.name,
      details: 'Check server logs for full error'
    });
  }
});

// PUT: Update a game
router.put('/games/:gameId', checkAdmin, async (req, res) => {
  try {
    const { gameId } = req.params;
    const updates = req.body;

    console.log(`📝 Updating game: ${gameId}`);
    console.log('   Received updates:', JSON.stringify(updates, null, 2));

    // Filter allowed fields
    const allowedFields = [
      'league', 'home_team', 'away_team', 'home_odds', 'draw_odds', 'away_odds',
      'scheduled_time', 'status', 'home_score', 'away_score', 'minute',
      'markets', 'is_kickoff_started', 'game_paused', 'kickoff_start_time', 'kickoff_paused_at', 'is_halftime'
    ];

    const sanitizedUpdates = {};
    Object.keys(updates).forEach((key) => {
      // Skip phone and other auth fields
      if (key === 'phone') return;
      
      const dbKey = key.includes('_') ? key : key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbKey)) {
        sanitizedUpdates[dbKey] = updates[key];
      }
    });

    console.log('   Sanitized updates:', JSON.stringify(sanitizedUpdates, null, 2));

    // Auto-set kickoff_start_time ONLY when status changes to live AND no kickoff_start_time provided
    if (sanitizedUpdates.status === 'live' && sanitizedUpdates.is_kickoff_started && !sanitizedUpdates.kickoff_start_time) {
      sanitizedUpdates.kickoff_start_time = new Date().toISOString();
      console.log('   Auto-setting kickoff_start_time:', sanitizedUpdates.kickoff_start_time);
    } else if (sanitizedUpdates.status === 'live' && sanitizedUpdates.kickoff_start_time) {
      // Prioritize frontend-sent kickoff_start_time
      console.log('   Using frontend-provided kickoff_start_time:', sanitizedUpdates.kickoff_start_time);
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      console.warn('⚠️ No valid fields to update');
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    sanitizedUpdates.updated_at = new Date().toISOString();

    // Try to find the game - check if gameId is UUID or text game_id
    let existingGameQuery = supabase.from('games').select('*');
    
    if (isValidUUID(gameId)) {
      console.log(`   GameId looks like UUID, searching by id`);
      existingGameQuery = existingGameQuery.eq('id', gameId);
    } else {
      console.log(`   GameId looks like text, searching by game_id`);
      existingGameQuery = existingGameQuery.eq('game_id', gameId);
    }

    const { data: existingGame, error: findError } = await existingGameQuery.maybeSingle();

    if (findError) {
      console.error('❌ Error finding game:', findError.message, findError.code);
      return res.status(400).json({ 
        error: 'Failed to find game', 
        details: findError.message,
        code: findError.code
      });
    }

    if (!existingGame) {
      console.error('❌ No game found for update:', gameId);
      return res.status(404).json({ error: 'Game not found', gameId });
    }

    console.log(`   Found game with id: ${existingGame.id}, game_id: ${existingGame.game_id}`);

    // Now update using the UUID
    const { data: game, error } = await supabase
      .from('games')
      .update(sanitizedUpdates)
      .eq('id', existingGame.id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating game:', error.message, error.code, error.details);
      return res.status(400).json({ 
        error: 'Failed to update game', 
        details: error.message,
        code: error.code
      });
    }

    console.log(`✅ Game updated successfully:`, game.game_id || game.id);

    // Log admin action (optional)
    try {
      if (req.user.id && req.user.id !== 'unknown') {
        await supabase.from('admin_logs').insert([{
          admin_id: req.user.id,
          action: 'update_game',
          target_type: 'game',
          target_id: game.id,
          changes: sanitizedUpdates,
          description: 'Updated game details',
        }]);
      }
    } catch (logError) {
      console.warn('⚠️ Failed to log admin action:', logError.message);
      // Don't fail the request if logging fails
    }

    res.json({ success: true, game });
  } catch (error) {
    console.error('❌ Update game error:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update game', 
      details: error.message 
    });
  }
});

// DELETE: Delete a game
router.delete('/games/:gameId', checkAdmin, async (req, res) => {
  try {
    const { gameId } = req.params;

    console.log(`🗑️  Deleting game: ${gameId}`);

    // Find the game first - check if gameId is UUID or text game_id
    let existingGameQuery = supabase.from('games').select('*');
    
    if (isValidUUID(gameId)) {
      console.log(`   GameId looks like UUID, searching by id`);
      existingGameQuery = existingGameQuery.eq('id', gameId);
    } else {
      console.log(`   GameId looks like text, searching by game_id`);
      existingGameQuery = existingGameQuery.eq('game_id', gameId);
    }

    const { data: existingGame, error: findError } = await existingGameQuery.maybeSingle();

    if (findError) {
      console.error('❌ Error finding game:', findError.message);
      throw findError;
    }

    if (!existingGame) {
      console.error('❌ No game found for delete:', gameId);
      return res.status(404).json({ error: 'Game not found' });
    }

    // Try to delete by UUID
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', existingGame.id);

    if (error) {
      console.error('❌ Error deleting game:', error.message);
      throw error;
    }

    console.log(`✅ Game deleted successfully`);

    // Log admin action (optional)
    try {
      if (req.user.id && req.user.id !== 'unknown') {
        // Note: We can't log with gameId since it's text, not UUID
        // The game has been deleted so we can't query it
        console.log('ℹ️ Game deleted but audit logging skipped (game_id is not UUID)');
      }
    } catch (logError) {
      console.warn('⚠️ Failed to log admin action:', logError.message);
    }

    res.json({ success: true, message: 'Game deleted' });
  } catch (error) {
    console.error('❌ Delete game error:', error.message);
    res.status(500).json({ error: 'Failed to delete game', details: error.message });
  }
});

// PUT: Update game score
router.put('/games/:gameId/score', checkAdmin, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { homeScore, awayScore, minute, status } = req.body;

    console.log(`📝 Updating score for game: ${gameId}, score: ${homeScore}-${awayScore}, minute: ${minute}`);

    const updates = {
      home_score: homeScore,
      away_score: awayScore,
      minute: minute,
      status: status,
      updated_at: new Date().toISOString(),
    };

    // Find the game first - check if gameId is UUID or text game_id
    let existingGameQuery = supabase.from('games').select('*');
    
    if (isValidUUID(gameId)) {
      console.log(`   GameId looks like UUID, searching by id`);
      existingGameQuery = existingGameQuery.eq('id', gameId);
    } else {
      console.log(`   GameId looks like text, searching by game_id`);
      existingGameQuery = existingGameQuery.eq('game_id', gameId);
    }

    const { data: existingGame, error: findError } = await existingGameQuery.maybeSingle();

    if (findError) {
      console.error('❌ Error finding game:', findError.message);
      throw findError;
    }

    if (!existingGame) {
      console.error('❌ No game found for score update:', gameId);
      return res.status(404).json({ error: 'Game not found' });
    }

    console.log(`   Found game with id: ${existingGame.id}`);

    // Try to update by UUID
    let { data: game, error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', existingGame.id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating game score:', error.message);
      throw error;
    }

    if (!game) {
      console.error('❌ No game found for score update:', gameId);
      return res.status(404).json({ error: 'Game not found' });
    }

    console.log(`✅ Game score updated: ${homeScore}-${awayScore}`);

    // Log admin action (optional)
    try {
      if (req.user.id && req.user.id !== 'unknown') {
        console.log('ℹ️ Score update logged');
      }
    } catch (logError) {
      console.warn('⚠️ Failed to log admin action:', logError.message);
    }

    // 🔥 NEW: Automatically settle bets related to this game
    console.log(`\n🔥 Triggering automatic bet settlement for game ${existingGame.id}`);
    await settleBetsForGame(existingGame.id, game);

    res.json({ success: true, game });
  } catch (error) {
    console.error('❌ Update score error:', error.message);
    res.status(500).json({ error: 'Failed to update score', details: error.message });
  }
});

// PUT: Update game markets
router.put('/games/:gameId/markets', checkAdmin, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { markets } = req.body;

    if (!markets || typeof markets !== 'object') {
      return res.status(400).json({ error: 'Invalid markets data' });
    }

    console.log(`📝 Updating markets for game: ${gameId}`, Object.keys(markets).length, 'markets');

    // Try to find game by either UUID (id) or text game_id
    let gameQuery = supabase.from('games').select('id, game_id');
    
    if (isValidUUID(gameId)) {
      console.log(`   GameId looks like UUID, searching by id`);
      gameQuery = gameQuery.eq('id', gameId);
    } else {
      console.log(`   GameId looks like text, searching by game_id`);
      gameQuery = gameQuery.eq('game_id', gameId);
    }

    const { data: game, error: gameError } = await gameQuery.single();

    if (gameError || !game) {
      console.error('❌ Game not found with gameId:', gameId, gameError?.message);
      return res.status(404).json({ error: 'Game not found', details: gameError?.message });
    }

    const gameUUID = game.id;
    console.log(`✅ Found game UUID: ${gameUUID} for gameId: ${gameId}`);

    // Delete existing markets for this game
    const { error: deleteError } = await supabase
      .from('markets')
      .delete()
      .eq('game_id', gameUUID);

    if (deleteError) {
      console.warn('⚠️ Error deleting existing markets:', deleteError.message);
      // Continue anyway, we'll insert/update new ones
    } else {
      console.log('✅ Deleted existing markets');
    }

    // Insert new market entries
    const marketEntries = Object.entries(markets).map(([marketKey, odds]) => ({
      game_id: gameUUID,
      market_type: determineMarketType(marketKey),
      market_key: marketKey,
      odds: parseFloat(odds) || 0
    }));

    console.log(`📝 Preparing to insert ${marketEntries.length} market entries`);

    if (marketEntries.length > 0) {
      const { error: insertError } = await supabase
        .from('markets')
        .insert(marketEntries);

      if (insertError) {
        console.error('❌ Error inserting markets:', insertError.message, insertError.details);
        return res.status(500).json({ 
          error: 'Failed to insert markets', 
          details: insertError.message,
          code: insertError.code
        });
      }
      console.log(`✅ Successfully inserted ${marketEntries.length} markets`);
    }

    console.log(`✅ Markets updated successfully for game ${gameId}`);

    res.json({ success: true, game, marketCount: marketEntries.length });
  } catch (error) {
    console.error('❌ Update markets error:', error.message);
    res.status(500).json({ error: 'Failed to update markets', details: error.message });
  }
});

// PUT: Mark halftime
router.put('/games/:gameId/halftime', checkAdmin, async (req, res) => {
  try {
    const { gameId } = req.params;

    console.log(`⏱️  Marking halftime for game: ${gameId}`);

    // Find the game first - check if gameId is UUID or text game_id
    let existingGameQuery = supabase.from('games').select('*');
    
    if (isValidUUID(gameId)) {
      console.log(`   GameId looks like UUID, searching by id`);
      existingGameQuery = existingGameQuery.eq('id', gameId);
    } else {
      console.log(`   GameId looks like text, searching by game_id`);
      existingGameQuery = existingGameQuery.eq('game_id', gameId);
    }

    const { data: existingGame, error: findError } = await existingGameQuery.maybeSingle();

    if (findError) {
      console.error('❌ Error finding game:', findError.message);
      return res.status(400).json({ error: 'Failed to find game', details: findError.message });
    }

    if (!existingGame) {
      console.error('❌ No game found for halftime:', gameId);
      return res.status(404).json({ error: 'Game not found' });
    }

    // Mark halftime and pause the game
    const updates = {
      is_halftime: true,
      game_paused: true,
      kickoff_paused_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: game, error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', existingGame.id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error marking halftime:', error.message);
      return res.status(400).json({ error: 'Failed to mark halftime', details: error.message });
    }

    console.log(`✅ Halftime marked for game ${gameId}`);
    res.json({ success: true, game });
  } catch (error) {
    console.error('❌ Halftime error:', error.message);
    res.status(500).json({ error: 'Failed to mark halftime', details: error.message });
  }
});

// PUT: Resume second half 
router.put('/games/:gameId/resume-second-half', checkAdmin, async (req, res) => {
  try {
    const { gameId } = req.params;

    console.log(`▶️  Resuming second half for game: ${gameId}`);

    // Find the game first - check if gameId is UUID or text game_id
    let existingGameQuery = supabase.from('games').select('*');
    
    if (isValidUUID(gameId)) {
      console.log(`   GameId looks like UUID, searching by id`);
      existingGameQuery = existingGameQuery.eq('id', gameId);
    } else {
      console.log(`   GameId looks like text, searching by game_id`);
      existingGameQuery = existingGameQuery.eq('game_id', gameId);
    }

    const { data: existingGame, error: findError } = await existingGameQuery.maybeSingle();

    if (findError) {
      console.error('❌ Error finding game:', findError.message);
      return res.status(400).json({ error: 'Failed to find game', details: findError.message });
    }

    if (!existingGame) {
      console.error('❌ No game found for resuming:', gameId);
      return res.status(404).json({ error: 'Game not found' });
    }

    // Calculate new kickoff time so timer will show 45:00
    // Formula: elapsed_ms = now - kickoff_start_time
    // We want: 45*60*1000 = now - kickoff_start_time
    // So: kickoff_start_time = now - (45*60*1000)
    const now = new Date();
    const secondsIntoSecondHalf = 45 * 60; // 45 minutes
    const newKickoffTime = new Date(now.getTime() - secondsIntoSecondHalf * 1000);

    // Resume second half
    const updates = {
      is_halftime: false,
      game_paused: false,
      kickoff_start_time: newKickoffTime.toISOString(),
      kickoff_paused_at: null,
      updated_at: now.toISOString()
    };

    const { data: game, error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', existingGame.id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error resuming second half:', error.message);
      return res.status(400).json({ error: 'Failed to resume second half', details: error.message });
    }

    console.log(`✅ Second half resumed for game ${gameId}, timer starting at 45:00`);
    res.json({ success: true, game });
  } catch (error) {
    console.error('❌ Resume second half error:', error.message);
    res.status(500).json({ error: 'Failed to resume second half', details: error.message });
  }
});

// PUT: End game
router.put('/games/:gameId/end', checkAdmin, async (req, res) => {
  try {
    const { gameId } = req.params;

    console.log(`🏁 Ending game: ${gameId}`);

    // Find the game first - check if gameId is UUID or text game_id
    let existingGameQuery = supabase.from('games').select('*');
    
    if (isValidUUID(gameId)) {
      console.log(`   GameId looks like UUID, searching by id`);
      existingGameQuery = existingGameQuery.eq('id', gameId);
    } else {
      console.log(`   GameId looks like text, searching by game_id`);
      existingGameQuery = existingGameQuery.eq('game_id', gameId);
    }

    const { data: existingGame, error: findError } = await existingGameQuery.maybeSingle();

    if (findError) {
      console.error('❌ Error finding game:', findError.message);
      return res.status(400).json({ error: 'Failed to find game', details: findError.message });
    }

    if (!existingGame) {
      console.error('❌ No game found for ending:', gameId);
      return res.status(404).json({ error: 'Game not found' });
    }

    // End the game
    const updates = {
      status: 'finished',
      updated_at: new Date().toISOString()
    };

    const { data: game, error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', existingGame.id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error ending game:', error.message);
      return res.status(400).json({ error: 'Failed to end game', details: error.message });
    }

    console.log(`✅ Game ended: ${gameId}`);
    res.json({ success: true, game });
  } catch (error) {
    console.error('❌ End game error:', error.message);
    res.status(500).json({ error: 'Failed to end game', details: error.message });
  }
});

// PUT: Update game details (teams, league, odds, kickoff time)
router.put('/games/:gameId/details', checkAdmin, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { league, homeTeam, awayTeam, homeOdds, drawOdds, awayOdds, kickoffTime } = req.body;

    console.log(`✏️  Updating game details for: ${gameId}`);

    // Find the game first
    let existingGameQuery = supabase.from('games').select('*');
    
    if (isValidUUID(gameId)) {
      existingGameQuery = existingGameQuery.eq('id', gameId);
    } else {
      existingGameQuery = existingGameQuery.eq('game_id', gameId);
    }

    const { data: existingGame, error: findError } = await existingGameQuery.maybeSingle();

    if (findError || !existingGame) {
      console.error('❌ Game not found:', findError?.message);
      return res.status(404).json({ error: 'Game not found' });
    }

    // Update game details
    const updates = {
      league: league || existingGame.league,
      home_team: homeTeam || existingGame.home_team,
      away_team: awayTeam || existingGame.away_team,
      home_odds: homeOdds !== undefined ? parseFloat(homeOdds) : existingGame.home_odds,
      draw_odds: drawOdds !== undefined ? parseFloat(drawOdds) : existingGame.draw_odds,
      away_odds: awayOdds !== undefined ? parseFloat(awayOdds) : existingGame.away_odds,
      time: kickoffTime || existingGame.time,
      updated_at: new Date().toISOString()
    };

    const { data: game, error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', existingGame.id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating game details:', error.message);
      return res.status(400).json({ error: 'Failed to update game', details: error.message });
    }

    console.log(`✅ Game details updated: ${gameId}`);
    res.json({ success: true, game });
  } catch (error) {
    console.error('❌ Update details error:', error.message);
    res.status(500).json({ error: 'Failed to update game details', details: error.message });
  }
});

// PUT: Set custom time for live game timer
router.put('/games/:gameId/set-time', checkAdmin, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { minute, seconds } = req.body;

    console.log(`⏱️  Setting custom time for game: ${gameId} to ${minute}:${seconds}`);

    if (minute === undefined || seconds === undefined) {
      return res.status(400).json({ error: 'Minute and seconds required' });
    }

    // Find the game first
    let existingGameQuery = supabase.from('games').select('*');
    
    if (isValidUUID(gameId)) {
      existingGameQuery = existingGameQuery.eq('id', gameId);
    } else {
      existingGameQuery = existingGameQuery.eq('game_id', gameId);
    }

    const { data: existingGame, error: findError } = await existingGameQuery.maybeSingle();

    if (findError || !existingGame) {
      console.error('❌ Game not found:', findError?.message);
      return res.status(404).json({ error: 'Game not found' });
    }

    // Calculate new kickoff time to achieve desired minute:seconds
    // Formula: elapsed_ms = now - kickoff_start_time
    // We want: (minute * 60 + seconds) * 1000 = now - kickoff_start_time
    // So: kickoff_start_time = now - ((minute * 60 + seconds) * 1000)
    const now = new Date();
    const targetElapsedSeconds = minute * 60 + seconds;
    const newKickoffTime = new Date(now.getTime() - targetElapsedSeconds * 1000);

    const updates = {
      kickoff_start_time: newKickoffTime.toISOString(),
      updated_at: now.toISOString()
    };

    const { data: game, error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', existingGame.id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error setting time:', error.message);
      return res.status(400).json({ error: 'Failed to set time', details: error.message });
    }

    console.log(`✅ Timer set to ${minute}:${String(seconds).padStart(2, '0')} for game ${gameId}`);
    res.json({ 
      success: true, 
      game,
      newKickoffStartTime: newKickoffTime.toISOString(),
      minute,
      seconds
    });
  } catch (error) {
    console.error('❌ Set time error:', error.message);
    res.status(500).json({ error: 'Failed to set time', details: error.message });
  }
});

// PUT: Edit user balance
router.put('/users/:userId/balance', checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { balance, reason } = req.body;

    console.log(`\n💳 [PUT /api/admin/users/${userId}/balance] Updating user balance`);
    console.log(`   New balance: ${balance}, Reason: ${reason}`);

    if (balance === undefined) {
      return res.status(400).json({ success: false, error: 'Balance amount required' });
    }

    // Get user's current balance
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('account_balance')
      .eq('id', userId);

    if (userError) {
      console.error(`❌ Database error finding user:`, userError);
      return res.status(500).json({ success: false, error: 'Database query error', details: userError.message });
    }

    if (!users || users.length === 0) {
      console.error(`❌ User not found with id: ${userId}`);
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = users[0];

    const previousBalance = user.account_balance;
    const balanceChange = balance - previousBalance;

    console.log(`   Previous balance: ${previousBalance}, Change: ${balanceChange}`);

    // Update user balance
    const { data: updatedUsers, error: updateError } = await supabase
      .from('users')
      .update({ account_balance: balance, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select();

    if (updateError) {
      console.error(`❌ Error updating balance:`, updateError);
      return res.status(500).json({ success: false, error: 'Failed to update balance', details: updateError.message });
    }

    if (!updatedUsers || updatedUsers.length === 0) {
      console.error(`❌ Balance update failed - no rows returned`);
      return res.status(500).json({ success: false, error: 'Balance update returned no data' });
    }

    const updatedUser = updatedUsers[0];

    console.log(`✅ Balance updated successfully`);

    // Record balance history
    await supabase.from('balance_history').insert([{
      user_id: userId,
      balance_before: previousBalance,
      balance_after: balance,
      change: balanceChange,
      reason: reason || 'Admin adjustment',
      created_by: req.user.phone,
      created_at: new Date().toISOString(),
    }]);

    // Log admin action (optional)
    try {
      if (req.user.id && req.user.id !== 'unknown') {
        await supabase.from('admin_logs').insert([{
          admin_id: req.user.id,
          action: 'update_balance',
          target_type: 'user',
          target_id: userId,
          changes: { previous_balance: previousBalance, new_balance: balance, change_amount: balanceChange },
          description: `Balance changed from ${previousBalance} to ${balance}: ${reason}`,
        }]);
      }
    } catch (logError) {
      console.warn('⚠️ Failed to log admin action:', logError.message);
    }

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Update balance error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to update balance', details: error.message });
  }
});

// PUT: Update user details (name, email, phone, password)
router.put('/users/:userId/details', checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, phone, password } = req.body;

    console.log(`\n👤 [PUT /api/admin/users/${userId}/details] Updating user details`);
    console.log(`   Fields: name=${name}, email=${email}, phone=${phone}`);

    // Build update object with only provided fields
    // DATABASE SCHEMA USES: username, phone_number, email, password
    const updateData = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.username = name;  // Map 'name' to 'username' (database field)
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone_number = phone;
    if (password !== undefined) updateData.password = password;

    console.log(`   Updating with data:`, updateData);

    // Update user details
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select();

    if (updateError) {
      console.error(`❌ Error updating user details:`, updateError);
      return res.status(500).json({ success: false, error: 'Failed to update user details', details: updateError.message });
    }

    if (!updatedUser || updatedUser.length === 0) {
      console.error(`❌ No user found or updated with id: ${userId}`);
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    console.log(`✅ User details updated successfully for: ${updatedUser[0].username}`);

    console.log(`✅ User details updated successfully`);

    // Log admin action
    try {
      if (req.user.id && req.user.id !== 'unknown') {
        await supabase.from('admin_logs').insert([{
          admin_id: req.user.id,
          action: 'update_user_details',
          target_type: 'user',
          target_id: userId,
          changes: updateData,
          description: `User details updated by admin`,
        }]);
      }
    } catch (logError) {
      console.warn('⚠️ Failed to log admin action:', logError.message);
    }

    res.json({ success: true, user: updatedUser[0] });
  } catch (error) {
    console.error('Update user details error:', error);
    res.status(500).json({ success: false, error: 'Failed to update user details', details: error.message });
  }
});

// POST: Resolve payment
router.post('/payments/:paymentId/resolve', checkAdmin, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status required' });
    }

    const { data: payment, error } = await supabase
      .from('payments')
      .update({
        payment_status: status,
        resolved_by: req.user.phone,
        resolved_at: new Date().toISOString(),
        notes: notes || '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) throw error;

    // Log admin action (optional)
    try {
      if (req.user.id && req.user.id !== 'unknown') {
        await supabase.from('admin_logs').insert([{
          admin_id: req.user.id,
          action: 'resolve_payment',
          target_type: 'payment',
          target_id: paymentId,
          changes: { payment_status: status, notes },
          description: `Payment resolved with status: ${status}`,
        }]);
      }
    } catch (logError) {
      console.warn('⚠️ Failed to log admin action:', logError.message);
    }

    res.json({ success: true, payment });
  } catch (error) {
    console.error('Resolve payment error:', error);
    res.status(500).json({ error: 'Failed to resolve payment' });
  }
});

// PUT: Activate user withdrawal
router.put('/users/:userId/activate-withdrawal', checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { withdrawalId } = req.body;
    const ACTIVATION_FEE = 30; // KSH

    console.log(`\n💸 [PUT /api/admin/users/${userId}/activate-withdrawal] Activating withdrawal`);
    console.log(`   Withdrawal ID: ${withdrawalId}`);
    console.log(`   Activation Fee: KSH ${ACTIVATION_FEE}`);

    // Update withdrawal status
    const { data: withdrawals, error } = await supabase
      .from('payments')
      .update({
        payment_status: 'processing',
        activated_by: req.user.phone,
        activated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', withdrawalId)
      .select();

    if (error) {
      console.error(`❌ Error activating withdrawal:`, error);
      return res.status(500).json({ success: false, error: 'Failed to activate withdrawal', details: error.message });
    }

    if (!withdrawals || withdrawals.length === 0) {
      console.error(`❌ Withdrawal not found with id: ${withdrawalId}`);
      return res.status(404).json({ success: false, error: 'Withdrawal not found' });
    }

    const withdrawal = withdrawals[0];
    console.log(`✅ Withdrawal activated successfully`);

    // 💳 Record activation fee as transaction
    console.log(`\n💳 Recording activation fee transaction...`);
    try {
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'activation_fee',
          amount: ACTIVATION_FEE,
          status: 'completed',
          external_reference: `ACT-${Date.now()}-${withdrawalId}`,
          description: `Withdrawal activation fee`,
          created_at: new Date().toISOString(),
          date: new Date().toISOString()
        });

      if (txError) {
        console.warn('⚠️ Failed to record activation fee transaction:', txError.message);
      } else {
        console.log(`✅ Activation fee transaction recorded`);
      }
    } catch (txError) {
      console.warn('⚠️ Error recording activation fee:', txError.message);
    }

    // Deduct activation fee from user balance
    console.log(`\n💰 Deducting activation fee from user balance...`);
    try {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('account_balance')
        .eq('id', userId)
        .single();

      if (!userError && user) {
        const newBalance = Math.max(0, parseFloat(user.account_balance) - ACTIVATION_FEE);
        const { error: balanceError } = await supabase
          .from('users')
          .update({ account_balance: newBalance, updated_at: new Date().toISOString() })
          .eq('id', userId);

        if (balanceError) {
          console.warn('⚠️ Failed to deduct activation fee:', balanceError.message);
        } else {
          console.log(`✅ Activation fee deducted. New balance: KSH ${newBalance}`);
        }
      }
    } catch (err) {
      console.warn('⚠️ Error updating user balance for activation fee:', err.message);
    }

    // Log admin action (optional)
    try {
      if (req.user.id && req.user.id !== 'unknown') {
        await supabase.from('admin_logs').insert([{
          admin_id: req.user.id,
          action: 'activate_withdrawal',
          target_type: 'user',
          target_id: userId,
          changes: { withdrawal_id: withdrawalId, activation_fee: ACTIVATION_FEE },
          description: `Withdrawal activated - KSH ${ACTIVATION_FEE} activation fee charged`,
        }]);
      }
    } catch (logError) {
      console.warn('⚠️ Failed to log admin action:', logError.message);
    }

    res.json({ success: true, withdrawal, activationFeeCharged: ACTIVATION_FEE });
  } catch (error) {
    console.error('Activate withdrawal error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to activate withdrawal', details: error.message });
  }
});

// GET: Fetch all users (admin)
router.get('/users', checkAdmin, async (req, res) => {
  try {
    console.log('\n👥 [GET /api/admin/users] Fetching all users...');

    if (!supabase) {
      console.error('❌ Supabase client is not initialized');
      return res.status(503).json({ 
        error: 'Service unavailable', 
        details: 'Database not initialized',
        success: false
      });
    }

    // Fetch all users from users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('❌ Database query error:', usersError.message);
      return res.status(500).json({ 
        success: false, 
        error: usersError.message 
      });
    }

    console.log(`✅ Retrieved ${users?.length || 0} users successfully`);

    res.json({ success: true, users: users || [] });
  } catch (error) {
    console.error('❌ Get users error:', error.message || error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// GET: Admin dashboard stats
router.get('/stats', checkAdmin, async (req, res) => {
  try {
    const [
      { count: totalUsers },
      { count: totalGames },
      { count: pendingPayments },
      { count: totalBets },
    ] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact' }),
      supabase.from('games').select('id', { count: 'exact' }),
      supabase
        .from('payments')
        .select('id', { count: 'exact' })
        .eq('payment_status', 'pending'),
      supabase.from('bets').select('id', { count: 'exact' }),
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers || 0,
        totalGames: totalGames || 0,
        pendingPayments: pendingPayments || 0,
        totalBets: totalBets || 0,
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET: Fetch all transactions (deposits and withdrawals)
router.get('/transactions', checkAdmin, async (req, res) => {
  try {
    console.log('\n💳 [GET /api/admin/transactions] Fetching all transactions');

    if (!supabase) {
      console.error('❌ Supabase client is not initialized');
      return res.status(503).json({ 
        error: 'Service unavailable',
        success: false
      });
    }

    // Fetch all transactions
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (txError) {
      console.warn('⚠️  No transactions table found or fetch error:', txError.message);
      // Return empty array if table doesn't exist
      return res.json({ success: true, transactions: [] });
    }

    console.log(`✅ Retrieved ${transactions?.length || 0} transactions`);

    res.json({ 
      success: true, 
      transactions: transactions || []
    });
  } catch (error) {
    console.error('❌ Get transactions error:', error);
    res.json({ 
      success: true, 
      transactions: [],
      message: 'Could not fetch transactions'
    });
  }
});

// GET: Fetch user transaction history (user can access own, admin can access any)
router.get('/transactions/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { phone } = req.query; // Optional phone to verify user

    console.log(`\n💳 [GET /api/admin/transactions/user/${userId}] Fetching user transaction history`);

    if (!supabase) {
      console.error('❌ Supabase client is not initialized');
      return res.status(503).json({ 
        error: 'Service unavailable',
        success: false
      });
    }

    // Fetch user transactions with user details
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (txError) {
      console.warn('⚠️ Error fetching transactions:', txError.message);
      return res.json({ success: true, transactions: [] });
    }

    // Fetch user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username, phone_number, account_balance, total_bets, total_winnings, created_at')
      .eq('id', userId)
      .single();

    if (userError) {
      console.warn('⚠️ Error fetching user:', userError.message);
      return res.json({ 
        success: true, 
        transactions: transactions || [],
        user: null
      });
    }

    console.log(`✅ Retrieved ${transactions?.length || 0} transactions for user ${user?.username}`);

    res.json({ 
      success: true, 
      user,
      transactions: transactions || [],
      count: transactions?.length || 0
    });
  } catch (error) {
    console.error('❌ Get user transactions error:', error);
    res.json({ 
      success: true, 
      transactions: [],
      message: 'Could not fetch user transactions'
    });
  }
});

// GET: Fetch pending deposits (STK pushes waiting for admin confirmation)
router.get('/transactions/pending/deposits', checkAdmin, async (req, res) => {
  try {
    console.log('\n💳 [GET /api/admin/transactions/pending/deposits] Fetching pending deposits');

    if (!supabase) {
      console.error('❌ Supabase client is not initialized');
      return res.status(503).json({ 
        error: 'Service unavailable',
        success: false
      });
    }

    // Fetch all pending deposit transactions
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select(`
        *,
        user:users(id, username, phone_number, account_balance)
      `)
      .eq('type', 'deposit')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (txError) {
      console.warn('⚠️ Error fetching pending deposits:', txError.message);
      return res.json({ success: true, pending_deposits: [], count: 0 });
    }

    console.log(`✅ Retrieved ${transactions?.length || 0} pending deposits`);

    res.json({ 
      success: true, 
      pending_deposits: transactions || [],
      count: transactions?.length || 0
    });
  } catch (error) {
    console.error('❌ Get pending deposits error:', error);
    res.json({ 
      success: true, 
      pending_deposits: [],
      message: 'Could not fetch pending deposits'
    });
  }
});

// GET: Fetch transactions by status and type
router.get('/transactions/filter', checkAdmin, async (req, res) => {
  try {
    const { status, type, limit = 100, offset = 0 } = req.query;

    console.log('\n💳 [GET /api/admin/transactions/filter] Fetching filtered transactions');
    console.log('   Filters:', { status, type, limit, offset });

    if (!supabase) {
      console.error('❌ Supabase client is not initialized');
      return res.status(503).json({ 
        error: 'Service unavailable',
        success: false
      });
    }

    let query = supabase
      .from('transactions')
      .select(`
        *,
        user:users(id, username, phone_number, account_balance)
      `);

    if (status) {
      query = query.eq('status', status);
    }

    if (type) {
      query = query.eq('type', type);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: transactions, error: txError, count } = await query;

    if (txError) {
      console.warn('⚠️ Error filtering transactions:', txError.message);
      return res.json({ success: true, transactions: [], count: 0 });
    }

    console.log(`✅ Retrieved ${transactions?.length || 0} filtered transactions`);

    res.json({ 
      success: true, 
      transactions: transactions || [],
      count: count || 0
    });
  } catch (error) {
    console.error('❌ Filter transactions error:', error);
    res.json({ 
      success: true, 
      transactions: [],
      message: 'Could not filter transactions'
    });
  }
});

// GET: Admin search by username or phone number
router.get('/search', checkAdmin, async (req, res) => {
  try {
    const { query } = req.query;

    console.log(`\n🔍 [GET /api/admin/search] Searching for: "${query}"`);

    if (!query || query.trim().length < 2) {
      return res.json({ 
        success: true, 
        results: [],
        message: 'Search query must be at least 2 characters'
      });
    }

    if (!supabase) {
      console.error('❌ Supabase client is not initialized');
      return res.status(503).json({ 
        error: 'Service unavailable',
        success: false
      });
    }

    const searchTerm = query.toLowerCase().trim();

    // Search for users by username or phone number
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username, phone_number, account_balance, total_bets, total_winnings, is_admin, created_at, updated_at');

    if (usersError) {
      console.warn('⚠️ Error fetching users:', usersError.message);
      return res.json({ success: true, results: [] });
    }

    // Filter users by matching username or phone (client-side for flexibility)
    const filteredUsers = (users || [])
      .filter(u => 
        u.username?.toLowerCase().includes(searchTerm) || 
        u.phone_number?.includes(searchTerm)
      )
      .slice(0, 20); // Limit to 20 results

    console.log(`✅ Found ${filteredUsers.length} matching users`);

    // For each user, get their recent transactions
    const results = await Promise.all(
      filteredUsers.map(async (user) => {
        try {
          const { data: transactions } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);

          return {
            ...user,
            recentTransactions: transactions || []
          };
        } catch (err) {
          return {
            ...user,
            recentTransactions: []
          };
        }
      })
    );

    res.json({ 
      success: true, 
      results,
      count: results.length,
      query: searchTerm
    });
  } catch (error) {
    console.error('❌ Search error:', error);
    res.json({ 
      success: true, 
      results: [],
      message: 'Search error'
    });
  }
});

// GET: Fetch all payments (deposits/withdrawals)
router.get('/payments', checkAdmin, async (req, res) => {
  try {
    console.log('\n💰 [GET /api/admin/payments] Fetching all payments');

    if (!supabase) {
      console.error('❌ Supabase client is not initialized');
      return res.status(503).json({ 
        error: 'Service unavailable',
        success: false
      });
    }

    // Fetch all payments
    const { data: payments, error: payError } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (payError) {
      console.warn('⚠️  No payments found or fetch error:', payError.message);
      return res.json({ success: true, payments: [] });
    }

    console.log(`✅ Retrieved ${payments?.length || 0} payments`);

    res.json({ 
      success: true, 
      payments: payments || []
    });
  } catch (error) {
    console.error('❌ Get payments error:', error);
    res.json({ 
      success: true, 
      payments: [],
      message: 'Could not fetch payments'
    });
  }
});


// POST: Record withdrawal transaction (when user initiates withdrawal)
router.post('/transactions/withdrawal', async (req, res) => {
  try {
    const { userId, amount, phoneNumber, reason } = req.body;

    console.log(`\n🔄 [POST /api/admin/transactions/withdrawal] Recording withdrawal transaction`);
    console.log(`   User: ${userId}, Amount: KSH ${amount}, Phone: ${phoneNumber}`);

    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID and valid amount required' 
      });
    }

    if (!supabase) {
      console.error('❌ Supabase client is not initialized');
      return res.status(503).json({ 
        error: 'Service unavailable',
        success: false
      });
    }

    // Get user's current balance
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('account_balance')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('❌ User not found:', userError?.message);
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    const balanceBefore = parseFloat(user.account_balance);
    const newBalance = balanceBefore - parseFloat(amount);

    if (newBalance < 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Insufficient balance for withdrawal' 
      });
    }

    // Record withdrawal transaction
    const transactionRef = `WTH-${Date.now()}-${userId}`;
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'withdrawal',
        amount: parseFloat(amount),
        status: 'pending', // Will be completed when admin processes it
        external_reference: transactionRef,
        phone_number: phoneNumber,
        description: reason || 'User initiated withdrawal',
        created_at: new Date().toISOString(),
        date: new Date().toISOString()
      })
      .select()
      .single();

    if (txError) {
      console.error('❌ Error recording withdrawal transaction:', txError.message);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to record withdrawal',
        details: txError.message
      });
    }

    // Deduct from user balance
    const { error: balanceError } = await supabase
      .from('users')
      .update({ account_balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (balanceError) {
      console.warn('⚠️ Failed to update balance:', balanceError.message);
    } else {
      console.log(`✅ Withdrawal recorded. Previous balance: ${balanceBefore}, New balance: ${newBalance}`);
    }

    res.json({ 
      success: true, 
      transaction,
      message: 'Withdrawal recorded successfully'
    });
  } catch (error) {
    console.error('❌ Record withdrawal error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to record withdrawal',
      details: error.message
    });
  }
});

// PUT: Edit single match outcome in a multibet
router.put('/bets/:betId/selections/:selectionId/outcome', checkAdmin, async (req, res) => {
  try {
    const { betId, selectionId } = req.params;
    const { outcome } = req.body; // 'won' or 'lost'

    console.log(`\n✏️  [PUT /api/admin/bets/${betId}/selections/${selectionId}/outcome] Editing match outcome`);
    console.log(`   New outcome: ${outcome}`);

    if (!outcome || !['won', 'lost', 'pending'].includes(outcome)) {
      console.error('❌ Invalid outcome:', outcome);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid outcome - must be "won", "lost", or "pending"' 
      });
    }

    // Get the bet selection
    const { data: selection, error: selError } = await supabase
      .from('bet_selections')
      .select('*')
      .eq('id', selectionId)
      .single();

    if (selError || !selection) {
      console.error('❌ Selection not found:', selectionId);
      return res.status(404).json({ 
        success: false, 
        error: 'Bet selection not found' 
      });
    }

    console.log(`✅ Found selection:`, selection.id);

    // Update the selection outcome
    const { data: updatedSelection, error: updateError } = await supabase
      .from('bet_selections')
      .update({ outcome })
      .eq('id', selectionId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating selection outcome:', updateError.message);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to update outcome',
        details: updateError.message
      });
    }

    console.log(`✅ Selection outcome updated to: ${outcome}`);

    // Now check if all selections are finished and determine overall bet outcome
    // Get all selections for this bet
    const { data: allSelections } = await supabase
      .from('bet_selections')
      .select('*')
      .eq('bet_id', selection.bet_id);

    if (allSelections && allSelections.length > 0) {
      // Check if any selection is lost - if so, bet is lost
      const hasLostSelection = allSelections.some(sel => sel.outcome === 'lost');
      
      // Check if all selections are not pending
      const allFinished = allSelections.every(sel => sel.outcome !== 'pending');
      
      // Check if all selections are won
      const allWon = allSelections.every(sel => sel.outcome === 'won');

      let newBetStatus = 'Open'; // default

      if (hasLostSelection) {
        newBetStatus = 'Lost';
      } else if (allFinished && allWon) {
        newBetStatus = 'Won';
      } else if (allFinished && !allWon) {
        newBetStatus = 'Lost';
      }

      console.log(`   Calculated new bet status: ${newBetStatus}`);
      console.log(`   - Has lost selection: ${hasLostSelection}`);
      console.log(`   - All finished: ${allFinished}`);
      console.log(`   - All won: ${allWon}`);

      // Get the bet to access its data
      const { data: bet, error: betError } = await supabase
        .from('bets')
        .select('*')
        .eq('id', selection.bet_id)
        .single();

      if (!bet || betError) {
        console.error('❌ Error fetching bet:', betError?.message);
      } else {
        // Update bet status accordingly
        if (newBetStatus !== 'Open' && newBetStatus !== bet.status) {
          const amountWon = newBetStatus === 'Won' ? bet.potential_win : null;
          
          const { error: betUpdateError } = await supabase
            .from('bets')
            .update({ 
              status: newBetStatus,
              amount_won: amountWon,
              settled_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', selection.bet_id);

          if (betUpdateError) {
            console.warn('⚠️  Could not update bet status:', betUpdateError.message);
            // Continue anyway - selection was updated
          } else {
            console.log(`✅ Bet status automatically updated to: ${newBetStatus}`);

            // 🔥 NEW: Update user balance if bet won
            if (newBetStatus === 'Won' && amountWon && bet.user_id) {
              console.log(`\n💰 [BALANCE UPDATE] Processing winnings for user ID: ${bet.user_id}`);
              
              const { data: user, error: userError } = await supabase
                .from('users')
                .select('account_balance, total_winnings, phone_number')
                .eq('id', bet.user_id)
                .single();

              if (!user || userError) {
                console.error('   ❌ Error fetching user:', userError?.message);
              } else {
                const newBalance = parseFloat(user.account_balance) + parseFloat(amountWon);
                const newWinnings = (parseFloat(user.total_winnings) || 0) + parseFloat(amountWon);

                const { error: balanceError } = await supabase
                  .from('users')
                  .update({
                    account_balance: newBalance,
                    total_winnings: newWinnings,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', bet.user_id);

                if (balanceError) {
                  console.error('   ❌ Error updating user balance:', balanceError.message);
                } else {
                  console.log(`   ✅ User balance updated successfully`);
                  console.log(`      Phone: ${user.phone_number}`);
                  console.log(`      Previous balance: KSH ${user.account_balance}`);
                  console.log(`      New balance: KSH ${newBalance}`);
                  console.log(`      Winnings added: KSH ${amountWon}`);
                }
              }
            }
          }
        }
      }
    }

    // Log admin action
    try {
      if (req.user.id && req.user.id !== 'unknown') {
        await supabase.from('admin_logs').insert([{
          admin_id: req.user.id,
          action: 'edit_selection_outcome',
          target_type: 'bet_selection',
          target_id: selectionId,
          changes: { outcome },
          description: `Edited selection outcome to: ${outcome}`,
        }]);
      }
    } catch (logError) {
      console.warn('⚠️ Failed to log admin action:', logError.message);
    }

    res.json({ 
      success: true, 
      selection: updatedSelection,
      message: `Selection outcome updated to ${outcome}`
    });
  } catch (error) {
    console.error('❌ Edit selection outcome error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to edit selection outcome', 
      details: error.message 
    });
  }
});

// POST: Calculate and update all user balances based on betting history
router.post('/calculate-user-balances', checkAdmin, async (req, res) => {
  try {
    console.log('\n💰 [POST /api/admin/calculate-user-balances] Starting balance calculation...');

    // Fetch all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, balance, account_balance');

    if (usersError) throw usersError;
    console.log(`✅ Found ${users.length} users`);

    const updates = [];
    const report = [];

    for (const user of users) {
      console.log(`\n📊 Processing user: ${user.email} (ID: ${user.id})`);
      
      const currentBalance = user.balance || user.account_balance || 0;
      console.log(`   Current balance: KSH ${currentBalance}`);

      // Get all bets for this user
      const { data: bets, error: betsError } = await supabase
        .from('bets')
        .select('id, stake, status, amount_won')
        .eq('user_id', user.id);

      if (betsError) {
        console.warn(`⚠️ Error fetching bets for user ${user.id}:`, betsError.message);
        continue;
      }

      // Separate bets by status
      const wonBets = bets.filter((b) => b.status === 'Won');
      const lostBets = bets.filter((b) => b.status === 'Lost');
      const openBets = bets.filter((b) => b.status === 'Open');

      // Calculate totals
      const totalWon = wonBets.reduce((sum, b) => sum + (b.amount_won || 0), 0);
      const totalLostStakes = lostBets.reduce((sum, b) => sum + (b.stake || 0), 0);
      const totalOpenStakes = openBets.reduce((sum, b) => sum + (b.stake || 0), 0);

      // Formula: won amount - lost stakes - open stakes + 1000 bonus
      const calculatedBalance = Math.max(0, totalWon - totalLostStakes - totalOpenStakes + 1000);

      console.log(`   Won bets: ${wonBets.length} | Total won: KSH ${totalWon}`);
      console.log(`   Lost bets: ${lostBets.length} | Total stakes lost: KSH ${totalLostStakes}`);
      console.log(`   Open bets: ${openBets.length} | Total stakes at risk: KSH ${totalOpenStakes}`);
      console.log(`   ➜ Calculation: ${totalWon} - ${totalLostStakes} - ${totalOpenStakes} + 1000 = ${calculatedBalance}`);
      console.log(`   ✓ Calculated balance: KSH ${calculatedBalance}`);

      updates.push({
        userId: user.id,
        email: user.email,
        oldBalance: currentBalance,
        newBalance: calculatedBalance,
        won: totalWon,
        lost: totalLostStakes,
        open: totalOpenStakes,
        wonBets: wonBets.length,
        lostBets: lostBets.length,
        openBets: openBets.length,
      });

      report.push({
        email: user.email,
        oldBalance: currentBalance,
        newBalance: calculatedBalance,
        difference: calculatedBalance - currentBalance,
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('📋 BALANCE CALCULATION SUMMARY');
    console.log('='.repeat(80));

    report.forEach((r) => {
      const diff = r.difference > 0 ? `+${r.difference}` : r.difference;
      console.log(`${r.email}`);
      console.log(`  Old: KSH ${r.oldBalance} → New: KSH ${r.newBalance} (${diff})`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('🔄 Updating balances in Supabase...');
    console.log('='.repeat(80));

    // Update all balances
    let successCount = 0;
    const failedUpdates = [];

    for (const update of updates) {
      try {
        // Update balance field
        const { error: error1 } = await supabase
          .from('users')
          .update({ balance: update.newBalance })
          .eq('id', update.userId);

        // Also update account_balance field if it exists
        if (!error1) {
          await supabase
            .from('users')
            .update({ account_balance: update.newBalance })
            .eq('id', update.userId);
        }

        if (error1) {
          console.log(`❌ Error updating ${update.email}: ${error1.message}`);
          failedUpdates.push(update);
        } else {
          console.log(`✅ Updated ${update.email}: KSH ${update.oldBalance} → KSH ${update.newBalance}`);
          successCount++;
        }
      } catch (err) {
        console.log(`❌ Exception updating ${update.email}: ${err.message}`);
        failedUpdates.push(update);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`✨ SUCCESS: ${successCount}/${updates.length} users updated`);
    console.log('='.repeat(80));

    res.json({
      success: true,
      message: `Updated ${successCount}/${updates.length} user balances`,
      updatedCount: successCount,
      totalCount: updates.length,
      failed: failedUpdates.length,
      summary: report,
      details: updates
    });

  } catch (error) {
    console.error('❌ Calculate balances error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate user balances',
      details: error.message
    });
  }
});

// PUT: Mark transaction as completed (admin can confirm pending STK pushes)
router.put('/transactions/:transactionId/mark-completed', checkAdmin, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { mpesaReceipt, notes } = req.body;

    console.log(`\n💳 [PUT /api/admin/transactions/${transactionId}/mark-completed] Marking transaction as completed`);
    console.log('   Transaction ID:', transactionId);
    console.log('   M-Pesa Receipt (optional):', mpesaReceipt || 'not provided');

    // Fetch the transaction first
    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (fetchError || !transaction) {
      console.error('❌ Transaction not found:', transactionId);
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    console.log('✅ Transaction found:', {
      id: transaction.id,
      userId: transaction.user_id,
      amount: transaction.amount,
      status: transaction.status
    });

    // Check if transaction is pending
    if (transaction.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Transaction is already ${transaction.status}, cannot mark as completed`
      });
    }

    // Update transaction status to completed
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'completed',
        mpesa_receipt: mpesaReceipt || transaction.mpesa_receipt,
        admin_notes: notes || '',
        completed_at: new Date().toISOString(),
        completed_by: req.user?.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId);

    if (updateError) {
      console.error('❌ Error updating transaction:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to update transaction',
        error: updateError.message
      });
    }

    console.log('✅ Transaction marked as completed');

    // If this is a deposit and transaction was pending, ensure user balance is updated
    if (transaction.type === 'deposit' && transaction.status === 'pending') {
      try {
        console.log('💰 Updating user balance for completed deposit...');
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('account_balance')
          .eq('id', transaction.user_id)
          .single();

        if (!userError && user) {
          const newBalance = (parseFloat(user.account_balance) || 0) + parseFloat(transaction.amount);
          
          const { error: balanceError } = await supabase
            .from('users')
            .update({ account_balance: newBalance })
            .eq('id', transaction.user_id);

          if (balanceError) {
            console.warn('⚠️ Failed to update balance:', balanceError.message);
          } else {
            console.log(`✅ User balance updated: +KSH ${transaction.amount}, New balance: KSH ${newBalance}`);
          }
        }
      } catch (balanceError) {
        console.warn('⚠️ Error updating user balance:', balanceError.message);
      }
    }

    res.json({
      success: true,
      message: 'Transaction marked as completed',
      transaction: {
        id: transactionId,
        status: 'completed',
        completedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Mark transaction as completed error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark transaction as completed',
      error: error.message
    });
  }
});

module.exports = router;
