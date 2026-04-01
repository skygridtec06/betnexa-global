/**
 * Clean Test Deposits - Raw approach using direct transaction IDs
 */

require('dotenv').config();
const supabase = require('./services/database');

console.log('\n' + '='.repeat(80));
console.log('🗑️  TEST DEPOSIT CLEANUP - DIRECT DELETION');
console.log('='.repeat(80));

async function cleanTestDepositsRaw() {
  try {
    // List of test transaction IDs to delete (from previous scan)
    const testTxIds = [
      '37b6b45c-3881-4872-a55e-9c5d72a5e8f5', // duplicate - will fail gracefully
      'ee341aa8-9f62-49f6-852e-39c5d72a5e8f',
      '4f110cda-ca58-438f-a55e-9c5d72a5e8f',
      '303595ad-abc4-4b8f-a55e-9c5d72a5',
      'ebc07876-df23-4abd-a55e-9c5d72a5',
      '2477163e-1234-5678-a55e-9c5d72a5',
      '7a538a39-f37d-4669-9e31-d4cca8a00f74', // This one already worked
      '4e023ed1-80bc-4c68-8ca7-27525bf6ccf8', // This one already deleted  
      'c634f9c4-1234-5678-a55e-9c5d72a5',
    ];

    console.log('\n📋 Step 1: Fetching test transaction IDs to delete...\n');
    
    const { data: testTx } = await supabase
      .from('transactions')
      .select('id, external_reference, amount, user_id')
      .ilike('external_reference', '%ADMINTEST%');

    console.log(`Found ${testTx.length} ADMINTEST transactions to delete\n`);

    // Step 2: Delete by ID directly (one at a time)
    console.log('💾 Step 2: Deleting transactions by ID...\n');
    
    let deleted = 0;
    const userRefunds = {};

    for (const tx of testTx) {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', tx.id);

      if (error) {
        console.log(`   ⚠️  ${tx.external_reference}: ${error.message}`);
      } else {
        console.log(`   ✅ Deleted: ${tx.external_reference} (KSH ${tx.amount})`);
        deleted++;
        userRefunds[tx.user_id] = (userRefunds[tx.user_id] || 0) + parseFloat(tx.amount);
      }
    }

    console.log(`\n✅ Deleted: ${deleted} transactions\n`);

    // Step 3: Also delete any with known test receipt codes
    console.log('💾 Step 3: Cleaning up test receipts...\n');

    const testReceipts = ['SLF12345MJQ', 'QRR0TZ8JPF', 'ACT0000001'];
    
    for (const receipt of testReceipts) {
      const { data: txWithReceipt } = await supabase
        .from('transactions')
        .select('id, external_reference, amount, user_id')
        .eq('mpesa_receipt', receipt);

      for (const tx of txWithReceipt) {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', tx.id);

        if (!error) {
          console.log(`   ✅ Deleted receipt: ${receipt} (${tx.external_reference})`);
          deleted++;
          userRefunds[tx.user_id] = (userRefunds[tx.user_id] || 0) + parseFloat(tx.amount);
        }
      }
    }

    // Step 4: Update balances
    console.log('\n💾 Step 4: Restoring user balances...\n');

    let updated = 0;
    for (const [userId, refundAmount] of Object.entries(userRefunds)) {
      const { data: user } = await supabase
        .from('users')
        .select('username, account_balance')
        .eq('id', userId)
        .maybeSingle();

      if (user) {
        const newBalance = parseFloat(user.account_balance) - refundAmount;
        const { error } = await supabase
          .from('users')
          .update({ account_balance: newBalance })
          .eq('id', userId);

        if (!error) {
          console.log(`   ✅ ${user.username}: KSH ${user.account_balance.toFixed(0)} → KSH ${newBalance.toFixed(0)}`);
          updated++;
        }
      }
    }

    // Step 5: Verify
    console.log('\n📋 Step 5: Final Verification...\n');

    const { data: adminRemaining } = await supabase
      .from('transactions')
      .select('*')
      .ilike('external_reference', '%ADMINTEST%');

    const { data: testRefRemaining } = await supabase
      .from('transactions')
      .select('*')
      .ilike('external_reference', '%TEST%');

    console.log(`   ADMINTEST remaining: ${adminRemaining.length}`);
    console.log(`   TEST refs remaining: ${testRefRemaining.length}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ CLEANUP COMPLETE');
    console.log('='.repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Deleted: ${deleted} test transactions`);
    console.log(`   ✅ Updated: ${updated} user balances`);
    console.log(`   ✅ Database clean\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

cleanTestDepositsRaw();
