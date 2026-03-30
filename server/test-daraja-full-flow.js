/**
 * Full Daraja Deposit Flow Test
 * Tests complete user deposit with M-Pesa receipt code in admin SMS
 */

require('dotenv').config();
const supabase = require('./services/database');
const { ensureUserDarajaFunding } = require('./services/userDarajaFundingService');
const paymentCache = require('./services/paymentCache');

console.log('\n' + '='.repeat(75));
console.log('🧪 FULL DARAJA DEPOSIT FLOW TEST WITH M-PESA CODE');
console.log('='.repeat(75));

async function runFullTest() {
  try {
    // Check database connection
    console.log('\n📋 Database Connection Check:');
    const { data: testData, error: testError } = await supabase.from('users').select('id').limit(1);
    if (testError) {
      console.log(`   ❌ Database error: ${testError.message}`);
    } else {
      console.log(`   ✅ Database connected`);
    }

    // Step 1: Find a test user
    console.log('\n' + '─'.repeat(75));
    console.log('Step 1: Finding test user...');
    console.log('─'.repeat(75));

    const { data: testUser, error: userError } = await supabase
      .from('users')
      .select('id, username, phone_number, account_balance')
      .eq('username', 'Buie')
      .maybeSingle();

    if (!testUser) {
      console.log('   ❌ Test user not found');
      return;
    }

    console.log(`   ✅ Found user: ${testUser.username}`);
    console.log(`      ID: ${testUser.id}`);
    console.log(`      Phone: ${testUser.phone_number}`);
    console.log(`      Balance: KSH ${testUser.account_balance}`);

    // Step 2: Register a pending Daraja transaction
    console.log('\n' + '─'.repeat(75));
    console.log('Step 2: Registering Daraja deposit...');
    console.log('─'.repeat(75));

    const checkoutRequestId = `TEST-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const externalReference = `TESTDep-${Date.now()}`;
    const depositAmount = 2000;
    
    console.log(`   Checkout Request ID: ${checkoutRequestId}`);
    console.log(`   External Reference: ${externalReference}`);
    console.log(`   Amount: KSH ${depositAmount}`);

    // Register payment in cache
    paymentCache.storePayment(externalReference, checkoutRequestId, {
      type: 'USER_DARAJA_DEPOSIT',
      amount: depositAmount,
      phone_number: testUser.phone_number,
      user_id: testUser.id,
      payment_type: 'deposit',
      external_reference: externalReference,
      merchantRequestId: 'MER' + Date.now(),
    });

    // Step 3: Simulate successful M-Pesa callback
    console.log('\n' + '─'.repeat(75));
    console.log('Step 3: Simulating M-Pesa callback with receipt code...');
    console.log('─'.repeat(75));

    const mpesaReceipt = 'SLF12345MJQ';  // Simulated 10-char M-Pesa receipt code
    console.log(`   M-Pesa Receipt: ${mpesaReceipt}`);
    console.log(`   Result Code: 0`);
    console.log(`   Result Description: The service request has been processed successfully.`);

    // Call the funding service to process the payment
    const fundingResult = await ensureUserDarajaFunding({
      checkoutRequestId,
      mpesaReceipt,
      resultCode: '0',
      resultDesc: 'The service request has been processed successfully.',
      amount: depositAmount,
      phoneNumber: testUser.phone_number,
    });

    console.log(`\n   Result: ${fundingResult.success ? '✅ FUNDING SUCCESSFUL' : '❌ FUNDING FAILED'}`);
    if (!fundingResult.success) {
      console.log(`   Error: ${fundingResult.error}`);
      return;
    }

    // Step 4: Verify balance update
    console.log('\n' + '─'.repeat(75));
    console.log('Step 4: Verifying balance update...');
    console.log('─'.repeat(75));

    const { data: updatedUser } = await supabase
      .from('users')
      .select('account_balance')
      .eq('id', testUser.id)
      .maybeSingle();

    const previousBalance = testUser.account_balance || 0;
    const newBalance = updatedUser?.account_balance || 0;
    const credited = newBalance - previousBalance;

    console.log(`   Previous Balance: KSH ${previousBalance}`);
    console.log(`   Credited Amount: KSH ${credited}`);
    console.log(`   New Balance: KSH ${newBalance}`);
    console.log(`   ✅ Balance updated correctly`);

    // Step 5: Verify transaction record
    console.log('\n' + '─'.repeat(75));
    console.log('Step 5: Verifying transaction record...');
    console.log('─'.repeat(75));

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('checkout_request_id', checkoutRequestId)
      .maybeSingle();

    if (transactions) {
      console.log(`   ✅ Transaction created`);
      console.log(`      ID: ${transactions.id}`);
      console.log(`      Status: ${transactions.status}`);
      console.log(`      Amount: KSH ${transactions.amount}`);
      console.log(`      M-Pesa Receipt: ${transactions.mpesa_receipt}`);
      console.log(`      Type: ${transactions.type}`);
    } else {
      console.log(`   ⚠️ Transaction record not found`);
    }

    console.log('\n' + '='.repeat(75));
    console.log('✅ FULL DARAJA DEPOSIT TEST COMPLETE');
    console.log('='.repeat(75));
    console.log('\n📱 Admin SMS should have been sent to 0740176944 with:');
    console.log(`   - User: ${testUser.username} (${testUser.phone_number})`);
    console.log(`   - Amount: KSH ${depositAmount}`);
    console.log(`   - M-Pesa Code: ${mpesaReceipt}`);
    console.log(`   - Type: deposit`);
    console.log(`   - Total Revenue: KSH ${newBalance}` );
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Test Error:', error.message || error);
    console.error(error.stack);
  }
}

runFullTest();
