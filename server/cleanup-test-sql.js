/**
 * Clean Test Deposits - Using RPC function approach
 */

require('dotenv').config();
const supabase = require('./services/database');

console.log('\n' + '='.repeat(80));
console.log('🗑️  TEST DEPOSIT CLEANUP - ATTEMPTING DIRECT SQL');
console.log('='.repeat(80));

async function cleanTestDepositsViaSql() {
  try {
    console.log('\n📋 Step 1: Scanning database for test transactions...\n');

    // First, get all test transaction info we need
    const { data: testTxIds } = await supabase
      .from('transactions')
      .select('id, external_reference, amount, user_id, mpesa_receipt')
      .or('external_reference.ilike.%ADMINTEST%,external_reference.ilike.%TEST%,mpesa_receipt.in.("SLF12345MJQ","QRR0TZ8JPF","ACT0000001")');

    console.log(`Found ${testTxIds.length} test transactions\n`);

    // Group by user for balance restoration
    const userRefunds = {};
    testTxIds.forEach(tx => {
      userRefunds[tx.user_id] = (userRefunds[tx.user_id] || 0) + parseFloat(tx.amount);
    });

    // Display what will be deleted
    console.log('📋 Test transactions to delete:');
    let totalAmount = 0;
    testTxIds.slice(0, 5).forEach((tx, idx) => {
      console.log(`   ${idx + 1}. ${tx.external_reference} - KSH ${tx.amount} (Receipt: ${tx.mpesa_receipt})`);
      totalAmount += parseFloat(tx.amount);
    });
    if (testTxIds.length > 5) {
      console.log(`   ... and ${testTxIds.length - 5} more`);
    }
    console.log(`\n   Total: ${testTxIds.length} transactions, KSH ${totalAmount}\n`);

    // Step 2: Try deleting with just ID (no other conditions)
    console.log('💾 Step 2: Attempting deletion...\n');

    let deleted = 0;
    for (const tx of testTxIds) {
      try {
        // Try with only ID condition
        const { error: delError, data: delData } = await supabase
          .from('transactions')
          .delete()
          .eq('id', tx.id)
          .select();

        if (delError) {
          console.log(`   ❌ ${tx.external_reference}: ${delError.message.substring(0, 60)}`);
        } else {
          console.log(`   ✅ Deleted: ${tx.external_reference}`);
          deleted++;
        }
      } catch (err) {
        console.log(`   ❌ ${tx.external_reference}: Exception - ${err.message.substring(0, 40)}`);
      }
    }

    console.log(`\n✅ Successfully deleted: ${deleted}/${testTxIds.length}\n`);

    // Step 3: Restore balances anyway
    console.log('💾 Step 3: Restoring user balances...\n');

    for (const [userId, refundAmount] of Object.entries(userRefunds)) {
      const { data: user } = await supabase
        .from('users')
        .select('username, account_balance')
        .eq('id', userId)
        .maybeSingle();

      if (user) {
        const oldBalance = parseFloat(user.account_balance);
        const newBalance = oldBalance - refundAmount;
        
        const { error: updateError } = await supabase
          .from('users')
          .update({ account_balance: newBalance })
          .eq('id', userId);

        if (!updateError) {
          console.log(`   ✅ ${user.username}: KSH ${oldBalance.toFixed(0)} → KSH ${newBalance.toFixed(0)}`);
        }
      }
    }

    // Final check
    console.log('\n📋 Step 4: Final Status...\n');

    const { data: stillThere } = await supabase
      .from('transactions')
      .select('*')
      .or('external_reference.ilike.%ADMINTEST%,external_reference.ilike.%TEST%,mpesa_receipt.in.("SLF12345MJQ","QRR0TZ8JPF","ACT0000001")');

    console.log(`   Remaining test transactions: ${stillThere.length}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ OPERATION COMPLETE');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  }
}

cleanTestDepositsViaSql();
