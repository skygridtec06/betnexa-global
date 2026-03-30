/**
 * Test SMS Notification Service
 * Verifies that admin SMS notifications are working correctly
 */

require('dotenv').config();

const supabase = require('./services/database');
const { sendAdminDepositNotification, sendSms } = require('./services/smsService');

async function testAdminSMS() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 TESTING ADMIN SMS NOTIFICATION SERVICE');
  console.log('='.repeat(70));

  // Step 1: Check environment variables
  console.log('\n📋 Step 1: Checking environment variables...');
  const apiKey = process.env.TEXTSMS_API_KEY;
  const partnerId = process.env.TEXTSMS_PARTNER_ID;
  const shortcode = process.env.TEXTSMS_SHORTCODE;
  const adminPhone = process.env.ADMIN_SMS_PHONE;

  console.log(`   TEXTSMS_API_KEY: ${apiKey ? '✅ SET' : '❌ MISSING'}`);
  console.log(`   TEXTSMS_PARTNER_ID: ${partnerId ? '✅ SET' : '❌ MISSING'}`);
  console.log(`   TEXTSMS_SHORTCODE: ${shortcode ? '✅ SET' : '❌ MISSING'}`);
  console.log(`   ADMIN_SMS_PHONE: ${adminPhone ? '✅ SET (' + adminPhone + ')' : '❌ MISSING'}`);

  if (!apiKey || !partnerId) {
    console.error('\n❌ Missing required TextSMS credentials in environment variables!');
    process.exit(1);
  }

  // Step 2: Test raw SMS send
  console.log('\n📱 Step 2: Testing raw SMS to admin...');
  const testMessage = `🧪 BETNEXA SMS TEST - ${new Date().toLocaleString()}`;
  const smsSent = await sendSms(adminPhone, testMessage);
  
  if (smsSent) {
    console.log('✅ Raw SMS test successful!');
  } else {
    console.error('❌ Raw SMS test failed!');
  }

  // Step 3: Test admin deposit notification
  console.log('\n💰 Step 3: Testing admin deposit notification...');
  try {
    const testUserPhone = '0712345678';
    const testUsername = 'TestUser';
    const testAmount = 5000;
    const testType = 'deposit';
    
    // Calculate total revenue from database (or use mock)
    let totalRevenue = 0;
    try {
      const { data: revenueData, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('status', 'completed')
        .in('type', ['deposit']);
      
      if (!error && revenueData) {
        totalRevenue = revenueData.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
        console.log(`   Total revenue from DB: KSH ${totalRevenue}`);
      } else {
        console.log('   ⚠️ Could not fetch total revenue from DB, using 0');
      }
    } catch (dbError) {
      console.log('   ⚠️ Database error:', dbError.message);
    }

    console.log(`   Sending notification for deposit: KSH ${testAmount}`);
    await sendAdminDepositNotification(testUserPhone, testUsername, testAmount, testType, totalRevenue);
    console.log('✅ Admin deposit notification sent successfully!');
  } catch (error) {
    console.error('❌ Error sending admin notification:', error.message);
  }

  // Step 4: Verify via database
  console.log('\n🔍 Step 4: Checking recent transactions...');
  try {
    const { data: recentTx, error } = await supabase
      .from('transactions')
      .select('user_id, amount, type, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (!error && recentTx) {
      console.log(`   Found ${recentTx.length} recent transactions:`);
      recentTx.forEach((tx, i) => {
        console.log(`   ${i + 1}. ${tx.type} - KSH ${tx.amount} (${tx.status})`);
      });
    } else {
      console.log('   ⚠️ Could not fetch recent transactions');
    }
  } catch (err) {
    console.log('   ⚠️ Error checking transactions:', err.message);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ SMS Test Complete! Check your admin phone for test messages.');
  console.log('='.repeat(70) + '\n');
  
  process.exit(0);
}

// Run test
testAdminSMS().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
