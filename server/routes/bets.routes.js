/**
 * Bets Routes
 * Handles bet placement, retrieval, and settlement
 */

const express = require('express');
const router = express.Router();
const supabase = require('../services/database.js');

/**
 * POST /api/bets/place
 * Place a new bet and deduct from user balance
 */
router.post('/place', async (req, res) => {
  try {
    const { userId, phoneNumber, stake, potentialWin, totalOdds, selections } = req.body;

    console.log('\n🎲 [POST /api/bets/place] Placing bet');
    console.log('   User:', { userId, phoneNumber });
    console.log('   Stake:', stake);
    console.log('   Selections:', selections?.length || 0);

    if (!phoneNumber || !stake || !selections) {
      return res.status(400).json({
        success: false,
        error: 'Phone number, stake, and selections are required'
      });
    }

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, deposited_balance, total_bets')
      .eq('phone_number', phoneNumber)
      .single();

    if (userError || !user) {
      console.error('❌ User not found:', phoneNumber);
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if user has sufficient deposited balance
    if (user.deposited_balance < stake) {
      console.warn('⚠️ Insufficient deposited balance for user:', phoneNumber);
      return res.status(400).json({
        success: false,
        error: 'Insufficient deposited balance',
        balance: user.deposited_balance,
        required: stake
      });
    }

    // Deduct stake from deposited_balance
    const newDepositedBalance = user.deposited_balance - stake;
    const { error: updateError } = await supabase
      .from('users')
      .update({
        deposited_balance: newDepositedBalance,
        total_bets: (user.total_bets || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Error updating deposited balance:', updateError.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to update deposited balance',
        details: updateError.message
      });
    }

    // Create bet record
    const betId = `BET${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const now = new Date();
    const isoTimestamp = now.toISOString(); // Store as ISO for proper timezone conversion

    const { data: bet, error: betError } = await supabase
      .from('bets')
      .insert([{
        bet_id: betId,
        user_id: user.id,
        stake: parseFloat(stake),
        potential_win: parseFloat(potentialWin),
        total_odds: parseFloat(totalOdds),
        status: 'Open',
        bet_date: `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`,
        bet_time: `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`,
        created_at: isoTimestamp
      }])
      .select()
      .single();

    if (betError) {
      console.error('❌ Error creating bet:', betError.message);
      // Restore balance if bet creation fails
      await supabase
        .from('users')
        .update({ account_balance: user.account_balance })
        .eq('id', user.id);

      return res.status(500).json({
        success: false,
        error: 'Failed to create bet',
        details: betError.message
      });
    }

    // Create bet selections
    for (const selection of selections) {
      // Parse home and away teams from match string (format: "Home vs Away")
      const [homeTeam, awayTeam] = selection.match.split(' vs ').map(t => t.trim());
      
      // Get game UUID from game_id (matchId)
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('id')
        .eq('game_id', selection.matchId)
        .single();

      if (gameError || !game) {
        console.warn('⚠️ Game not found for matchId:', selection.matchId);
        continue;
      }

      await supabase
        .from('bet_selections')
        .insert([{
          bet_id: bet.id,
          game_id: game.id,
          market_key: selection.type,
          market_type: selection.market,
          market_label: selection.type,
          home_team: homeTeam || 'N/A',
          away_team: awayTeam || 'N/A',
          odds: parseFloat(selection.odds),
          outcome: 'pending'
        }]);
    }

    console.log('✅ Bet placed successfully:', betId);
    console.log('   Database ID (UUID):', bet.id);
    console.log('   Deposited Balance After: KSH', newDepositedBalance);

    res.json({
      success: true,
      bet: {
        id: bet.id,
        betId: betId,
        stake: parseFloat(stake),
        potentialWin: parseFloat(potentialWin),
        totalOdds: parseFloat(totalOdds),
        status: 'Open'
      },
      newDepositedBalance
    });
  } catch (error) {
    console.error('❌ Place bet error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to place bet',
      details: error.message
    });
  }
});

/**
 * GET /api/bets/user
 * Get all bets for a user
 */
router.get('/user', async (req, res) => {
  try {
    const { phoneNumber } = req.query;

    console.log('\n📋 [GET /api/bets/user] Fetching bets for:', phoneNumber);

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', phoneNumber)
      .single();

    if (userError || !user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get user bets with selections
    const { data: bets, error: betsError } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (betsError) {
      console.error('❌ Error fetching bets:', betsError.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch bets'
      });
    }

    // Get selections for each bet with game details
    const betsWithSelections = await Promise.all(
      (bets || []).map(async (bet) => {
        const { data: selections } = await supabase
          .from('bet_selections')
          .select('*, games:game_id(game_id)')
          .eq('bet_id', bet.id);

        return {
          ...bet,
          selections: (selections || []).map((sel) => ({
            ...sel,
            gameRefId: sel.games?.game_id // Add the text reference ID
          }))
        };
      })
    );

    console.log(`✅ Retrieved ${betsWithSelections.length} bets`);

    res.json({
      success: true,
      bets: betsWithSelections
    });
  } catch (error) {
    console.error('❌ Get bets error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get bets'
    });
  }
});

/**
 * PUT /api/bets/:betId/status
 * Update bet status (Open, Won, Lost, Void)
 */
router.put('/:betId/status', async (req, res) => {
  try {
    const { betId } = req.params;
    const { status, amountWon } = req.body;

    console.log('\n⚙️  [PUT /api/bets/:betId/status] Updating bet status');
    console.log('   Bet ID (UUID):', betId);
    console.log('   Status:', status);
    console.log('   Amount Won:', amountWon);

    // Build update object with status
    const updateData = {
      status: status,
      settled_at: status === 'Won' || status === 'Lost' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    // Add amount_won to bet record if bet is won
    if (status === 'Won' && amountWon) {
      updateData.amount_won = parseFloat(amountWon);
    }

    console.log('   📋 Updating bet with:', updateData);

    // Update bet status
    const { data: bet, error: updateError } = await supabase
      .from('bets')
      .update(updateData)
      .eq('id', betId)
      .select()
      .single();

    if (updateError || !bet) {
      console.error('❌ Error updating bet:', updateError?.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to update bet'
      });
    }

    console.log('✅ Bet status updated to:', status);
    console.log('   Updated bet:', bet);
    
    if (status === 'Won') {
      console.log('✅ Amount won recorded:', amountWon);
    }

    // If bet won, add winnings to user balance
    let updatedUser = null;
    if (status === 'Won' && amountWon && bet.user_id) {
      console.log(`\n💰 Processing winnings for user ID: ${bet.user_id}`);
      
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('winnings_balance, total_winnings, id, phone_number, username')
        .eq('id', bet.user_id)
        .single();

      if (!user) {
        console.error('❌ Error fetching user:', userError?.message);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch user',
          details: userError?.message
        });
      }

      console.log(`   Current winnings balance: KSH ${user.winnings_balance}`);
      console.log(`   Current total winnings: KSH ${user.total_winnings || 0}`);
      
      const newWinningsBalance = (user.winnings_balance || 0) + parseFloat(amountWon);
      const currentWinnings = user.total_winnings || 0;
      const newWinnings = currentWinnings + parseFloat(amountWon);

      console.log(`   New winnings balance will be: KSH ${newWinningsBalance}`);
      console.log(`   New total winnings will be: KSH ${newWinnings}`);
      console.log('   📝 Updating user in database...');

      const { data: updatedUserData, error: balanceError } = await supabase
        .from('users')
        .update({
          winnings_balance: newWinningsBalance,
          total_winnings: newWinnings,
          updated_at: new Date().toISOString()
        })
        .eq('id', bet.user_id)
        .select()
        .single();

      if (balanceError) {
        console.error('❌ Error updating winnings balance:', balanceError.message);
        return res.status(500).json({
          success: false,
          error: 'Failed to update winnings balance',
          details: balanceError.message
        });
      }

      updatedUser = updatedUserData;
      console.log(`✅ User winnings balance updated successfully`);
      console.log(`   Phone: ${updatedUser.phone_number}`);
      console.log(`   New winnings balance: KSH ${updatedUser.winnings_balance}`);
      console.log(`   New total winnings: KSH ${updatedUser.total_winnings}`);
    }

    // If bet lost, no winnings to add
    if (status === 'Lost') {
      console.log('❌ Bet marked as Lost - no winnings added');
    }

    console.log('\n✅ Response sent successfully');

    res.json({
      success: true,
      bet,
      updatedUser,
      message: `Bet ${status} and balance updated${status === 'Won' && updatedUser ? ` with KSH ${amountWon} added. New balance: KSH ${updatedUser.account_balance}` : ''}`
    });
  } catch (error) {
    console.error('❌ Update bet status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update bet status',
      details: error.message
    });
  }
});

/**
 * GET /api/bets/admin/all
 * Get all bets (admin only)
 */
router.get('/admin/all', async (req, res) => {
  try {
    console.log('\n👨‍💼 [GET /api/bets/admin/all] Fetching all bets with user data');

    const { data: bets, error } = await supabase
      .from('bets')
      .select(`
        *,
        users:user_id (
          id,
          username,
          phone_number,
          account_balance
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching bets:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch bets'
      });
    }

    console.log(`✅ Retrieved ${bets?.length || 0} bets with user data`);

    res.json({
      success: true,
      bets: bets || []
    });
  } catch (error) {
    console.error('❌ Get all bets error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get bets'
    });
  }
});

module.exports = router;
