/**
 * Comprehensive Admin SMS Diagnostic Test
 * Tests if admin SMS can be sent successfully
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { sendAdminDepositNotification, sendSms } = require('./services/smsService');

async function testAdminSms() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 ADMIN SMS DIAGNOSTIC TEST');
  console.log('='.repeat(70));

  // Step 1: Check environment variables
  console.log('\n[STEP 1] Checking environment variables...');
  console.log(`TEXTSMS_API_KEY: ${process.env.TEXTSMS_API_KEY ? '✅ SET (' + process.env.TEXTSMS_API_KEY.substring(0, 10) + '...)' : '❌ NOT SET'}`);
  console.log(`TEXTSMS_PARTNER_ID: ${process.env.TEXTSMS_PARTNER_ID ? '✅ SET (' + process.env.TEXTSMS_PARTNER_ID + ')' : '❌ NOT SET'}`);
  console.log(`TEXTSMS_SHORTCODE: ${process.env.TEXTSMS_SHORTCODE ? '✅ SET (' + process.env.TEXTSMS_SHORTCODE + ')' : '❌ NOT SET'}`);
  console.log(`ADMIN_SMS_PHONE: ${process.env.ADMIN_SMS_PHONE ? '✅ SET (' + process.env.ADMIN_SMS_PHONE + ')' : '❌ NOT SET (Will use default 0740176944)'}`);

  if (!process.env.TEXTSMS_API_KEY || !process.env.TEXTSMS_PARTNER_ID) {
    console.error('\n❌ CRITICAL: Missing TextSMS credentials. Admin SMS cannot be sent.');
    console.error('   Set TEXTSMS_API_KEY and TEXTSMS_PARTNER_ID in .env file');
    return;
  }

  // Step 2: Test direct SMS to admin
  console.log('\n[STEP 2] Testing direct SMS to admin phone (0740176944)...');
  const testMessage = `🧪 BETNEXA Admin SMS Test - ${new Date().toISOString()}`;
  const testResult1 = await sendSms('0740176944', testMessage);
  console.log(`Result: ${testResult1 ? '✅ SMS sent' : '❌ SMS failed'}`);

  // Step 3: Test sendAdminDepositNotification function
  console.log('\n[STEP 3] Testing sendAdminDepositNotification function...');
  const testDeposit = await sendAdminDepositNotification(
    '0712345678',  // User phone
    'TestUser',    // Username
    5000,          // Amount
    'deposit',     // Transaction type
    50000,         // Total revenue
    'TEST123ABC'   // M-Pesa receipt
  );
  console.log(`Result: ${testDeposit ? '✅ Admin deposit SMS sent' : '❌ Admin deposit SMS failed'}`);

  // Step 4: Test activation notification
  console.log('\n[STEP 4] Testing activation fee notification...');
  const testActivation = await sendAdminDepositNotification(
    '0723456789',
    'TestUser2',
    199,
    'activation',
    55000,
    'ACT123XYZ'
  );
  console.log(`Result: ${testActivation ? '✅ Activation SMS sent' : '❌ Activation SMS failed'}`);

  console.log('\n' + '='.repeat(70));
  console.log('✅ TEST COMPLETE - Check above logs for SMS send status');
  console.log('   If both sent successfully, admin SMS is working');
  console.log('   If failed, check TextSMS API credentials');
  console.log('='.repeat(70) + '\n');
}

testAdminSms().catch(err => {
  console.error('❌ Test error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
