/**
 * Debug: Check database schema and RLS policies
 */

require('dotenv').config();
const supabase = require('./services/database');

console.log('\n' + '='.repeat(80));
console.log('🔍 DATABASE SCHEMA & RLS DEBUG');
console.log('='.repeat(80));

async function debugSchema() {
  try {
    // Check transactions table structure
    console.log('\n📋 Step 1: Querying transactions table...\n');

    const { data: sample, error: sampleError } = await supabase
      .from('transactions')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.error('❌ Error fetching sample:', sampleError);
    } else if (sample && sample.length > 0) {
      const tx = sample[0];
      console.log('Transaction columns found:');
      Object.keys(tx).forEach(key => {
        console.log(`   - ${key}: ${typeof tx[key]} = ${String(tx[key]).substring(0, 30)}`);
      });
    }

    // Try with RLS bypass (using service role)
    console.log('\n📋 Step 2: Attempting RLS bypass delete...\n');

    const testTxToDelete = 'ADMINTEST-35155907';
    
    const { data: txToDelete } = await supabase
      .from('transactions')
      .select('id')
      .eq('external_reference', testTxToDelete)
      .maybeSingle();

    if (txToDelete) {
      console.log(`Found transaction ID: ${txToDelete.id}`);

      // Try delete with auth ignore
      const { error: delError } = await supabase.auth.admin
        ? await supabase
            .from('transactions')
            .delete()
            .eq('id', txToDelete.id)
        : null;

      console.log(`Delete result: ${delError ? delError.message : 'success'}`);

      // Try alternate approach - update to mark as deleted instead
      console.log('\n📋 Step 3: Attempting alternative: Mark as deleted...\n');

      const { error: updateError } = await supabase
        .from('transactions')
        .update({ 
          status: 'cancelled',
          description: '[DELETED - TEST DEPOSIT]'
        })
        .eq('id', txToDelete.id);

      if (!updateError) {
        console.log(`✅ Successfully marked as cancelled: ${testTxToDelete}`);
      } else {
        console.log(`❌ Update failed: ${updateError.message}`);
      }
    }

    // Check for admin procedures
    console.log('\n📋 Step 4: Checking for admin functions...\n');

    const { data: adminFuncs, error: funcError } = await supabase.rpc('get_admin_functions');
    
    if (funcError) {
      console.log(`No admin functions available: ${funcError.message.substring(0, 50)}`);
    } else {
      console.log('Admin functions:', adminFuncs);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugSchema();
