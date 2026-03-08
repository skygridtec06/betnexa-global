/**
 * Test script to verify balance updates on bet settlement
 * Run this to test the complete flow: place bet -> settle bet -> verify balance updated
 */

const API_URL = 'https://server-tau-puce.vercel.app';

// Test user credentials
const TEST_PHONE = '+254700123456';
const TEST_PASSWORD = 'password123';

async function testBalanceSettlement() {
  console.log('🧪 Starting Balance Settlement Test\n');

  try {
    // Step 1: Login to get user session
    console.log('📝 Step 1: Login to get user session');
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: TEST_PHONE,
        password: TEST_PASSWORD
      })
    });

    const loginData = await loginRes.json();
    if (!loginData.success || !loginData.user) {
      console.error('❌ Login failed:', loginData);
      return;
    }

    const user = loginData.user;
    console.log(`   ✅ Logged in as: ${user.name} (${user.phone})`);
    console.log(`   Initial Balance: KSH ${user.accountBalance}`);
    const initialBalance = user.accountBalance;
    const userId = user.id;

    // Step 2: Place a test bet
    console.log('\n📝 Step 2: Place a test bet');
    const placeBetRes = await fetch(`${API_URL}/api/bets/place`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        phoneNumber: user.phone,
        stake: 100,
        potentialWin: 500,
        totalOdds: 5.0,
        selections: [
          {
            matchId: 'test-match-1',
            match: 'Team A vs Team B',
            market: 'DC',
            type: '1X',
            odds: 1.5
          },
          {
            matchId: 'test-match-2',
            match: 'Team C vs Team D',
            market: 'O/U',
            type: 'Over 2.5',
            odds: 3.33
          }
        ]
      })
    });

    const placeBetData = await placeBetRes.json();
    if (!placeBetData.success) {
      console.error('❌ Bet placement failed:', placeBetData);
      return;
    }

    const betId = placeBetData.bet.id;
    const betIdHuman = placeBetData.bet.betId;
    const stake = placeBetData.bet.stake;
    const potentialWin = placeBetData.bet.potentialWin;
    const balanceAfterBet = placeBetData.newBalance;

    console.log(`   ✅ Bet placed successfully`);
    console.log(`   Bet ID (UUID): ${betId}`);
    console.log(`   Bet ID (Human): ${betIdHuman}`);
    console.log(`   Stake: KSH ${stake}`);
    console.log(`   Balance After Bet: KSH ${balanceAfterBet}`);
    console.log(`   Expected: KSH ${initialBalance - stake}`);

    if (balanceAfterBet !== initialBalance - stake) {
      console.error(`❌ Balance mismatch! Expected ${initialBalance - stake}, got ${balanceAfterBet}`);
      return;
    }

    // Step 3: Settle the bet (mark as Won)
    console.log('\n📝 Step 3: Settle the bet (mark as Won)');
    const settleRes = await fetch(`${API_URL}/api/bets/${betId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'Won',
        amountWon: potentialWin
      })
    });

    const settleData = await settleRes.json();
    
    console.log('   Settlement Response:', {
      success: settleData.success,
      betId: settleData.bet?.id,
      betStatus: settleData.bet?.status,
      message: settleData.message
    });

    if (!settleData.success) {
      console.error('❌ Settlement failed:', settleData);
      return;
    }

    if (!settleData.updatedUser) {
      console.error('❌ No updated user data in response!');
      console.error('   This means the balance was NOT updated in the database');
      return;
    }

    const newBalance = settleData.updatedUser.account_balance;
    const expectedNewBalance = balanceAfterBet + potentialWin;

    console.log(`   ✅ Bet marked as Won`);
    console.log(`   Amount Won: KSH ${potentialWin}`);
    console.log(`   Balance After Settlement: KSH ${newBalance}`);
    console.log(`   Expected: KSH ${expectedNewBalance}`);

    if (newBalance !== expectedNewBalance) {
      console.error(`❌ Balance mismatch! Expected ${expectedNewBalance}, got ${newBalance}`);
      return;
    }

    // Step 4: Verify bet was updated with amount_won
    console.log('\n📝 Step 4: Verify bet record was updated');
    console.log(`   Bet Status in DB: ${settleData.bet?.status}`);
    console.log(`   Amount Won in DB: ${settleData.bet?.amount_won}`);

    if (settleData.bet?.amount_won !== potentialWin) {
      console.error(`❌ Amount won not stored in bet record!`);
      return;
    }

    // Step 5: Fetch all bets to verify the update persisted
    console.log('\n📝 Step 5: Fetch all bets to verify settlement persisted');
    const getBetsRes = await fetch(`${API_URL}/api/bets/user?phoneNumber=${encodeURIComponent(TEST_PHONE)}`, {
      method: 'GET'
    });

    const getBetsData = await getBetsRes.json();
    if (!getBetsData.success) {
      console.error('❌ Failed to fetch bets:', getBetsData);
      return;
    }

    const settledBet = getBetsData.bets.find(b => b.id === betId);
    if (!settledBet) {
      console.error('❌ Bet not found in user bets list!');
      return;
    }

    console.log(`   ✅ Found settled bet in user bets list`);
    console.log(`   Status: ${settledBet.status}`);
    console.log(`   Amount Won: ${settledBet.amount_won}`);

    // Step 6: Do a fresh login to verify balance persists
    console.log('\n📝 Step 6: Fresh login to verify balance persisted');
    const freshLoginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: TEST_PHONE,
        password: TEST_PASSWORD
      })
    });

    const freshLoginData = await freshLoginRes.json();
    const finalBalance = freshLoginData.user.accountBalance;

    console.log(`   ✅ Fresh login successful`);
    console.log(`   Final Balance: KSH ${finalBalance}`);
    console.log(`   Expected: KSH ${expectedNewBalance}`);

    if (finalBalance === expectedNewBalance) {
      console.log('\n✅ ALL TESTS PASSED! Balance settlement is working correctly.');
    } else {
      console.error(`\n❌ TEST FAILED! Balance did not persist. Expected ${expectedNewBalance}, got ${finalBalance}`);
    }

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run the test
testBalanceSettlement().catch(console.error);
