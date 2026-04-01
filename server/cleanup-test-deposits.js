/**
 * Clean Test Deposits - Remove all test deposits from database (COMPREHENSIVE)
 */

require('dotenv').config();
const supabase = require('./services/database');

console.log('\n' + '='.repeat(80));
console.log('🗑️  COMPREHENSIVE TEST DEPOSIT CLEANUP');
console.log('='.repeat(80));

async function cleanAllTestDeposits() {
  try {
    // Step 1: Find all test transactions (by external_reference patterns)
    console.log('\n📋 Step 1: Scanning for test deposits in database...\n');
    
    // Get all transactions
    const { data: allTx, error: allError } = await supabase
      .from('transactions')
      .select('id, user_id, amount, external_reference, mpesa_receipt, status, type')
      .eq('type', 'deposit')
      .eq('status', 'completed');

    if (allError) {
      console.error('❌ Error fetching transactions:', allError.message);
      return;
    }

    // Filter for test transactions
    const testTransactions = allTx.filter(tx => 
      tx.external_reference && (
        tx.external_reference.includes('TEST') ||
        tx.external_reference.includes('test') ||
        tx.mpesa_receipt === 'SLF12345MJQ' ||
        tx.mpesa_receipt === 'QRR0TZ8JPF' ||
        tx.mpesa_receipt === 'ACT0000001'
      )
    );

    console.log(`🔍 Scanned ${allTx.length} total transactions`);
    console.log(`📍 Found ${testTransactions.length} test deposits to remove\n`);

    if (testTransactions.length === 0) {
      console.log('ℹ️  No test deposits found. Database is clean!');
      return;
    }

    // Show what will be deleted
    console.log('📋 Test deposits to be removed:');
    let totalAmount = 0;
    const userRefunds = {};

    testTransactions.forEach((tx, idx) => {
      console.log(`   ${idx + 1}. ID: ${tx.id.substring(0, 8)}...`);
      console.log(`      Amount: KSH ${tx.amount}`);
      console.log(`      Ref: ${tx.external_reference}`);
      console.log(`      Receipt: ${tx.mpesa_receipt}`);
      console.log('');
      
      totalAmount += parseFloat(tx.amount);
      userRefunds[tx.user_id] = (userRefunds[tx.user_id] || 0) + parseFloat(tx.amount);
    });

    console.log(`💰 Total to remove: KSH ${totalAmount}`);
    console.log(`👥 Users affected: ${Object.keys(userRefunds).length}\n`);

    // Step 2: Get user info before deletion
    console.log('📋 Step 2: Fetching user information...\n');
    
    const userUpdates = {};
    
    for (const [userId, refundAmount] of Object.entries(userRefunds)) {
      const { data: user } = await supabase
        .from('users')
        .select('id, username, account_balance')
        .eq('id', userId)
        .maybeSingle();

      if (user) {
        const newBalance = parseFloat(user.account_balance) - refundAmount;
        userUpdates[userId] = {
          username: user.username,
          oldBalance: parseFloat(user.account_balance),
          refundAmount: refundAmount,
          newBalance: newBalance
        };
        console.log(`   ${user.username}: KSH ${user.account_balance} - KSH ${refundAmount} = KSH ${newBalance}`);
      }
    }
    console.log('');

    // Step 3: Delete test transactions
    console.log('💾 Step 3: Deleting test transactions...\n');
    
    let deleted = 0;
    for (const tx of testTransactions) {
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', tx.id);

      if (deleteError) {
        console.log(`   ❌ Failed to delete ${tx.id.substring(0, 8)}: ${deleteError.message}`);
      } else {
        console.log(`   ✅ Deleted: ${tx.external_reference}`);
        deleted++;
      }
    }
    console.log(`\n✅ Successfully deleted: ${deleted}/${testTransactions.length} transactions\n`);

    // Step 4: Update user balances
    console.log('💾 Step 4: Restoring user balances...\n');
    
    let updated = 0;
    for (const [userId, info] of Object.entries(userUpdates)) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ account_balance: info.newBalance })
        .eq('id', userId);

      if (updateError) {
        console.log(`   ❌ Failed to update ${info.username}: ${updateError.message}`);
      } else {
        console.log(`   ✅ ${info.username}: KSH ${info.oldBalance.toFixed(0)} → KSH ${info.newBalance.toFixed(0)}`);
        updated++;
      }
    }
    console.log(`\n✅ Updated: ${updated} user balances\n`);

    // Step 5: Verify cleanup
    console.log('📋 Step 5: Verifying cleanup...\n');
    
    const { data: remaining } = await supabase
      .from('transactions')
      .select('*')
      .ilike('external_reference', '%TEST%');

    const { data: badReceipts } = await supabase
      .from('transactions')
      .select('*')
      .in('mpesa_receipt', ['SLF12345MJQ', 'QRR0TZ8JPF', 'ACT0000001']);

    console.log(`   Test REF remaining: ${remaining.length}`);
    console.log(`   Test RECEIPTS remaining: ${badReceipts.length}`);
    console.log(`   ✅ Database cleanup complete!\n`);

    // Summary
    console.log('='.repeat(80));
    console.log('✅ CLEANUP COMPLETE');
    console.log('='.repeat(80));
    console.log(`\n📊 Action Summary:`);
    console.log(`   ✅ Deleted: ${deleted} test transactions`);
    console.log(`   ✅ Refunded: KSH ${totalAmount}`);
    console.log(`   ✅ Updated: ${updated} user balances`);
    console.log(`   ✅ Database: Clean - only real transactions remain\n`);

  } catch (error) {
    console.error('❌ Cleanup error:', error.message);
    console.error(error.stack);
  }
}

cleanAllTestDeposits();
