/**
 * SMS Testing with M-Pesa Transaction Codes
 * Tests admin notifications for:
 * 1. Regular user deposits with M-Pesa code
 * 2. Admin deposits with M-Pesa code
 * 3. Withdrawal activation with M-Pesa code
 */

require('dotenv').config();
const { sendAdminDepositNotification } = require('./services/smsService');

console.log('\n' + '='.repeat(75));
console.log('🧪 TESTING ADMIN SMS NOTIFICATION WITH M-PESA CODES');
console.log('='.repeat(75));

async function runTests() {
  console.log('\n📋 Environment Variables Check:');
  console.log(`   TEXTSMS_API_KEY: ${process.env.TEXTSMS_API_KEY ? '✅ SET' : '❌ NOT SET'}`);
  console.log(`   TEXTSMS_PARTNER_ID: ${process.env.TEXTSMS_PARTNER_ID ? '✅ SET' : '❌ NOT SET'}`);
  console.log(`   TEXTSMS_SHORTCODE: ${process.env.TEXTSMS_SHORTCODE ? '✅ SET' : '❌ NOT SET'}`);
  console.log(`   ADMIN_SMS_PHONE: ${process.env.ADMIN_SMS_PHONE ? '✅ SET (' + process.env.ADMIN_SMS_PHONE + ')' : '❌ NOT SET'}`);

  // Test 1: User deposit with M-Pesa receipt
  console.log('\n' + '─'.repeat(75));
  console.log('Test 1: Regular User Deposit with M-Pesa Receipt Code');
  console.log('─'.repeat(75));
  
  const mpesaReceipt1 = 'QRR0TZ8JPF';  // 10 char M-Pesa code
  console.log(`📱 Sending SMS for user deposit, Receipt: ${mpesaReceipt1}`);
  console.log(`   User: Buie (0740176945), Amount: KSH 1000, Type: deposit`);
  
  try {
    const result1 = await sendAdminDepositNotification(
      '0740176945',
      'Buie',
      1000,
      'deposit',
      36000,  // Total revenue
      mpesaReceipt1
    );
    console.log(`   Result: ${result1 ? '✅ SMS SENT' : '❌ SMS FAILED'}`);
  } catch (err) {
    console.error(`   Error: ${err.message}`);
  }

  // Wait 2 seconds between tests
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Admin deposit with M-Pesa receipt
  console.log('\n' + '─'.repeat(75));
  console.log('Test 2: Admin Account Deposit with M-Pesa Receipt Code');
  console.log('─'.repeat(75));
  
  const mpesaReceipt2 = 'ADMINFUND123456789';  // Longer code, should extract last 10
  console.log(`📱 Sending SMS for admin deposit, Receipt: ${mpesaReceipt2} (will extract last 10)`);
  console.log(`   Admin: Admin User (0740176944), Amount: KSH 5000, Type: admin-deposit`);
  
  try {
    const result2 = await sendAdminDepositNotification(
      '0740176944',
      'Admin User',
      5000,
      'admin-deposit',
      41000,  // Total revenue after admin deposit
      mpesaReceipt2
    );
    console.log(`   Result: ${result2 ? '✅ SMS SENT' : '❌ SMS FAILED'}`);
  } catch (err) {
    console.error(`   Error: ${err.message}`);
  }

  // Wait 2 seconds between tests
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: Withdrawal activation fee with M-Pesa receipt
  console.log('\n' + '─'.repeat(75));
  console.log('Test 3: Withdrawal Activation Fee with M-Pesa Receipt Code');
  console.log('─'.repeat(75));
  
  const mpesaReceipt3 = 'ACT0000001';  // 10 char activation code
  console.log(`📱 Sending SMS for activation fee, Receipt: ${mpesaReceipt3}`);
  console.log(`   User: John Doe (0741234567), Amount: KSH 100, Type: activation`);
  
  try {
    const result3 = await sendAdminDepositNotification(
      '0741234567',
      'John Doe',
      100,
      'activation',
      41100,  // Total revenue
      mpesaReceipt3
    );
    console.log(`   Result: ${result3 ? '✅ SMS SENT' : '❌ SMS FAILED'}`);
  } catch (err) {
    console.error(`   Error: ${err.message}`);
  }

  // Wait 2 seconds between tests
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 4: Priority fee with M-Pesa receipt
  console.log('\n' + '─'.repeat(75));
  console.log('Test 4: Priority Fee with M-Pesa Receipt Code');
  console.log('─'.repeat(75));
  
  const mpesaReceipt4 = 'PRI9876543210';  // Longer code
  console.log(`📱 Sending SMS for priority fee, Receipt: ${mpesaReceipt4} (will extract last 10: 9876543210)`);
  console.log(`   User: Jane Smith (0742345678), Amount: KSH 50, Type: priority`);
  
  try {
    const result4 = await sendAdminDepositNotification(
      '0742345678',
      'Jane Smith',
      50,
      'priority',
      41150,  // Total revenue
      mpesaReceipt4
    );
    console.log(`   Result: ${result4 ? '✅ SMS SENT' : '❌ SMS FAILED'}`);
  } catch (err) {
    console.error(`   Error: ${err.message}`);
  }

  // Wait 2 seconds before final summary
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n' + '='.repeat(75));
  console.log('✅ SMS TESTING COMPLETE');
  console.log('='.repeat(75));
  console.log('\n📱 Check your admin phone (0740176944) for 4 test messages');
  console.log('   - Each should show the M-Pesa receipt code');
  console.log('   - Admin deposit should show "ADMIN DEPOSIT" type');
  console.log('   - All should show the total revenue\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
