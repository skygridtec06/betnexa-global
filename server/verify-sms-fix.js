/**
 * Verify that the SMS notification fix is working correctly
 * Tests the sendAdminDepositNotification function with a full M-Pesa code
 */

const { sendAdminDepositNotification } = require('./services/smsService');

console.log('🧪 TESTING SMS NOTIFICATION FIX\n');

async function runTest() {
  try {
    // Test parameters
    const testUserPhone = '254741234567';
    const testUsername = 'JohnDoe';
    const testAmount = 5000;
    const testTransactionType = 'deposit';
    const testTotalRevenue = 123456;
    const testMpesaReceipt = 'UD4T08TBZH';  // Full M-Pesa code like the user needs
    
    console.log(`📝 Test Parameters:`);
    console.log(`   User Phone: ${testUserPhone}`);
    console.log(`   Username: ${testUsername}`);
    console.log(`   Amount: KSH ${testAmount}`);
    console.log(`   Type: ${testTransactionType}`);
    console.log(`   Total Revenue: KSH ${testTotalRevenue}`);
    console.log(`   M-Pesa Receipt: ${testMpesaReceipt}`);
    console.log(`\n🔍 Expected in SMS:`);
    console.log(`   Code: ${testMpesaReceipt}`);
    console.log(`   Total Revenue: KSH ${Number(testTotalRevenue).toFixed(0)}`);
    console.log(`\n📤 Sending test SMS...`);
    
    // Call the function
    const result = await sendAdminDepositNotification(
      testUserPhone,
      testUsername,
      testAmount,
      testTransactionType,
      testTotalRevenue,
      testMpesaReceipt
    );
    
    console.log(`\n✅ SMS sent successfully: ${result}`);
    console.log(`\n💡 CHECK THE SERVER LOGS ABOVE to see the exact message that will be sent`);
    console.log(`   Look for: [ADMIN_SMS] Message prepared...`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

runTest();
