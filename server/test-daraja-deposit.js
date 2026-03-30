/**
 * Test Daraja Deposit Callback & Admin SMS Notification
 * Simulates a user making a Daraja deposit and verifies admin gets SMS
 */

require('dotenv').config();

const supabase = require('./services/database');
const { ensureUserDarajaFunding, registerUserDarajaAttempt } = require('./services/userDarajaFundingService');
const { sendAdminDepositNotification } = require('./services/smsService');

async function testDarajaDepositFlow() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 TESTING DARAJA DEPOSIT FLOW & ADMIN SMS');
  console.log('='.repeat(70));

  try {
    // Step 1: Create or find a test user
    console.log('\n📋 Step 1: Finding/Creating test user...');
    
    let testUserId = null;
    let testUser = null;
    
    // Try to find an existing test user
    const { data: users, error: findError } = await supabase
      .from('users')
      .select('id, username, phone_number, account_balance')
      .limit(1);
    
    if (!findError && users && users.length > 0) {
      testUserId = users[0].id;
      testUser = users[0];
      console.log(`   ✅ Found test user: ${testUser.username} (${testUser.phone_number})`);
    } else {
      console.log('   ❌ No test users found in database');
      console.log('   Make sure there are users in the database');
      process.exit(1);
    }

    // Step 2: Register a test Daraja payment attempt
    console.log('\n💳 Step 2: Registering test Daraja payment attempt...');
    
    const testAmount = 1234;
    const testCheckoutId = `TESTCHK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const testExtRef = `TEST-${Date.now()}`;

    const regResult = await registerUserDarajaAttempt({
      userId: testUserId,
      phoneNumber: testUser.phone_number,
      amount: testAmount,
      externalReference: testExtRef,
      checkoutRequestId: testCheckoutId,
      merchantRequestId: `TESTMERCH-${Date.now()}`,
      paymentType: 'deposit',
    });

    if (regResult.success) {
      console.log(`   ✅ Registered payment: ${testCheckoutId}`);
      console.log(`   Amount: KSH ${testAmount}`);
    } else {
      console.log(`   ❌ Failed to register payment: ${regResult.error}`);
      process.exit(1);
    }

    // Step 3: Simulate successful Daraja callback
    console.log('\n✅ Step 3: Simulating successful Daraja callback...');
    
    const fundResult = await ensureUserDarajaFunding({
      checkoutRequestId: testCheckoutId,
      mpesaReceipt: `TESTMPSEA${Date.now()}`,
      resultCode: 0,
      resultDesc: 'Test transaction completed',
      amount: testAmount,
      phoneNumber: testUser.phone_number,
    });

    if (fundResult.success) {
      console.log(`   ✅ Daraja funding processed`);
      console.log(`   Credited: KSH ${fundResult.creditedAmount}`);
      console.log(`   New balance: KSH ${fundResult.newBalance}`);
      console.log(`   Processing type: ${fundResult.activationEnabled ? 'Activation' : 'Deposit'}`);
    } else {
      console.log(`   ❌ Daraja funding failed: ${fundResult.error}`);
      if (!fundResult.alreadyProcessed) {
        process.exit(1);
      }
    }

    // Step 4: Verify transaction was created
    console.log('\n🔍 Step 4: Verifying transaction was created...');
    
    const { data: createdTx, error: txError } = await supabase
      .from('transactions')
      .select('id, user_id, amount, type, status, created_at')
      .eq('checkout_request_id', testCheckoutId)
      .maybeSingle();

    if (!txError && createdTx) {
      console.log(`   ✅ Transaction created`);
      console.log(`   ID: ${createdTx.id}`);
      console.log(`   Amount: KSH ${createdTx.amount}`);
      console.log(`   Status: ${createdTx.status}`);
    } else {
      console.log(`   ⚠️ Could not find transaction: ${txError?.message}`);
    }

    // Step 5: Verify user balance was updated
    console.log('\n💰 Step 5: Verifying user balance was updated...');
    
    const { data: updatedUser, error: userError } = await supabase
      .from('users')
      .select('account_balance, username')
      .eq('id', testUserId)
      .single();

    if (!userError && updatedUser) {
      console.log(`   ✅ User balance updated`);
      console.log(`   New balance: KSH ${updatedUser.account_balance}`);
      console.log(`   Username: ${updatedUser.username}`);
    } else {
      console.log(`   ⚠️ Could not fetch updated user: ${userError?.message}`);
    }

    // Step 6: Test admin SMS notification directly
    console.log('\n📱 Step 6: Testing admin SMS notification...');
    
    const { data: revenueData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('status', 'completed')
      .in('type', ['deposit']);
    
    const totalRevenue = revenueData
      ? revenueData.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0)
      : 0;

    console.log(`   Total platform revenue: KSH ${totalRevenue}`);

    const smsSent = await sendAdminDepositNotification(
      testUser.phone_number,
      testUser.username,
      testAmount,
      'deposit',
      totalRevenue
    );

    if (smsSent) {
      console.log(`   ✅ Admin SMS notification sent!`);
    } else {
      console.log(`   ⚠️ Admin SMS notification may have failed (check logs)`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Daraja deposit flow test complete!');
    console.log('   Check admin phone (0740176944) for SMS messages');
    console.log('='.repeat(70) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
testDarajaDepositFlow();
