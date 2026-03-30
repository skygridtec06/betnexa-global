/**
 * Comprehensive SMS Diagnostic Test
 * Tests SMS service with detailed debugging
 */

require('dotenv').config();
const https = require('https');

console.log('\n' + '='.repeat(80));
console.log('🔍 SMS SERVICE DIAGNOSTIC TEST');
console.log('='.repeat(80));

// Step 1: Check environment
console.log('\n📋 Step 1: Environment Variables Check');
console.log('─'.repeat(80));

const apiKey = (process.env.TEXTSMS_API_KEY || '').trim();
const partnerId = (process.env.TEXTSMS_PARTNER_ID || '').trim();
const shortcode = (process.env.TEXTSMS_SHORTCODE || '').trim();
const adminPhone = process.env.ADMIN_SMS_PHONE || '0740176944';

console.log(`TEXTSMS_API_KEY: ${apiKey ? '✅ SET' : '❌ NOT SET'}`);
if (apiKey) console.log(`  Length: ${apiKey.length} chars`);
console.log(`TEXTSMS_PARTNER_ID: ${partnerId ? '✅ SET' : '❌ NOT SET'}`);
if (partnerId) console.log(`  Value: ${partnerId}`);
console.log(`TEXTSMS_SHORTCODE: ${shortcode ? '✅ SET' : '❌ NOT SET'}`);
if (shortcode) console.log(`  Value: ${shortcode}`);
console.log(`ADMIN_SMS_PHONE: ${adminPhone ? '✅ SET' : '❌ NOT SET'}`);
console.log(`  Value: ${adminPhone}`);

if (!apiKey || !partnerId) {
  console.error('\n❌ CRITICAL: Missing required environment variables!');
  process.exit(1);
}

// Step 2: Test raw HTTPS connection to TextSMS
console.log('\n📋 Step 2: Direct HTTPS Connection Test');
console.log('─'.repeat(80));

function testRawHttpsConnection() {
  return new Promise((resolve) => {
    const testPayload = {
      apikey: apiKey,
      partnerID: String(partnerId),
      message: '🧪 BETNEXA SMS Test - Connection Check',
      shortcode: shortcode || 'TextSMS',
      mobile: '254740176944',
    };

    console.log(`📤 Sending test payload to sms.textsms.co.ke...`);
    console.log(`   API Key: ${apiKey.substring(0, 10)}...`);
    console.log(`   Partner ID: ${partnerId}`);
    console.log(`   Mobile: 254740176944`);

    const bodyData = JSON.stringify(testPayload);
    const options = {
      hostname: 'sms.textsms.co.ke',
      path: '/api/services/sendsms/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyData),
      },
    };

    const req = https.request(options, (res) => {
      console.log(`📥 Response received: HTTP ${res.statusCode}`);
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        console.log(`📃 Raw response: ${raw}`);
        try {
          const parsed = JSON.parse(raw);
          console.log(`✅ JSON Parsed:`, JSON.stringify(parsed).substring(0, 200));
          
          // Check various response formats
          const hasResponses = parsed.responses && Array.isArray(parsed.responses);
          const hasCode = parsed['response-code'] || parsed.response_code;
          const hasStatus = parsed.status || parsed.success;
          
          console.log(`   - Has responses[]: ${hasResponses ? '✅' : '❌'}`);
          console.log(`   - Has response-code: ${hasCode ? '✅' : '❌'}`);
          console.log(`   - Has status/success: ${hasStatus ? '✅' : '❌'}`);
          
          resolve(true);
        } catch (e) {
          console.error(`❌ Failed to parse: ${e.message}`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error(`❌ HTTPS request error: ${err.message}`);
      resolve(false);
    });

    req.setTimeout(5000, () => {
      console.error(`❌ Request timeout`);
      req.destroy();
      resolve(false);
    });

    req.write(bodyData);
    req.end();
  });
}

// Step 3: Test SMS Service module
async function testSmsService() {
  console.log('\n📋 Step 3: SMS Service Module Test');
  console.log('─'.repeat(80));

  try {
    const { sendSms, sendAdminDepositNotification } = require('./services/smsService');
    
    console.log(`✅ SMS Service module loaded`);
    console.log(`   Functions available: sendSms, sendAdminDepositNotification`);

    // Test 1: Send test message
    console.log(`\n🧪 Sub-test 3A: Direct sendSms call`);
    const result1 = await sendSms('0740176944', '🧪 BETNEXA SMS Direct Test - Check if received');
    console.log(`   Result: ${result1 ? '✅ SUCCESS' : '❌ FAILED'}`);

    // Wait 2 seconds
    await new Promise(r => setTimeout(r, 2000));

    // Test 2: Send admin notification
    console.log(`\n🧪 Sub-test 3B: Admin Deposit Notification`);
    const result2 = await sendAdminDepositNotification(
      '0740176945',
      'TestUser',
      1500,
      'deposit',
      40000,
      'TEST12345MJQ'
    );
    console.log(`   Result: ${result2 ? '✅ SUCCESS' : '❌ FAILED'}`);

    return result1 || result2;
  } catch (err) {
    console.error(`❌ Error loading SMS service: ${err.message}`);
    console.error(err.stack);
    return false;
  }
}

// Step 4: Test phone normalization
console.log('\n📋 Step 4: Phone Number Normalization Test');
console.log('─'.repeat(80));

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '254' + digits.slice(1);
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) return '254' + digits;
  return digits;
}

const testNumbers = [
  '0740176944',
  '740176944',
  '254740176944',
  '740176944',
  '+254740176944',
];

testNumbers.forEach(num => {
  const normalized = normalizePhone(num);
  const isValid = normalized && normalized.length >= 10;
  console.log(`  ${num.padEnd(16)} → ${normalized} [${isValid ? '✅' : '❌'}]`);
});

// Main execution
async function main() {
  try {
    const httpTest = await testRawHttpsConnection();
    
    if (!httpTest) {
      console.error('\n⚠️  Raw HTTPS connection test failed. SMS will not work.');
    } else {
      console.log('\n✅ Raw HTTPS connection successful');
    }

    // Wait before next test
    await new Promise(r => setTimeout(r, 2000));

    const smsServiceTest = await testSmsService();

    console.log('\n' + '='.repeat(80));
    console.log('📊 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(80));
    console.log(`Env Variables: ✅ SET`);
    console.log(`HTTPS Connection: ${httpTest ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`SMS Service: ${smsServiceTest ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`Overall Status: ${smsServiceTest && httpTest ? '✅ ALL SYSTEMS GO' : '❌ ISSUES DETECTED'}`);
    
    console.log('\n🔧 Next Steps:');
    if (smsServiceTest) {
      console.log('   ✅ SMS system appears to be working');
      console.log('   → Check 0740176944 for test messages');
      console.log('   → Deploy to production if messages received');
    } else {
      console.log('   ❌ SMS system has issues');
      console.log('   → Check TEXTSMS API credentials');
      console.log('   → Verify network connectivity');
      console.log('   → Check TextSMS account status');
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  }
}

main();
