#!/usr/bin/env node

/**
 * Test Deposit Script
 * Tests STK push with new SKYGRID TECHNOLOGIES account reference
 */

const https = require('https');

const API_URL = process.env.API_URL || 'https://betnexa-78ztits6o-nel-developers.vercel.app';

// Test deposit parameters
const testDeposit = {
  userId: 'test-user-12345',
  phoneNumber: '254712345678',  // Replace with real M-Pesa test number
  amount: 1000,
  paymentType: 'deposit'
};

console.log('\n🚀 Testing Daraja STK Push with SKYGRID TECHNOLOGIES...\n');
console.log('📋 Test Parameters:');
console.log(`   API URL: ${API_URL}`);
console.log(`   User ID: ${testDeposit.userId}`);
console.log(`   Phone: ${testDeposit.phoneNumber}`);
console.log(`   Amount: KSH ${testDeposit.amount}`);
console.log(`   Payment Type: ${testDeposit.paymentType}`);
console.log('');

// Make API request
const postData = JSON.stringify(testDeposit);

const options = {
  hostname: API_URL.replace('https://', '').split('/')[0],
  port: 443,
  path: '/api/payments/daraja/initiate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  }
};

console.log('🔄 Sending STK push request...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      console.log('✅ Response received:\n');
      console.log(JSON.stringify(response, null, 2));
      
      if (response.success) {
        console.log('\n✅ STK PUSH INITIATED SUCCESSFULLY!\n');
        console.log('📱 Expected on phone:');
        console.log('   Account Reference: SKYGRID TECHNOLOGIES');
        console.log('   Paybill Number: 4046271');
        console.log(`   Amount: KSH ${testDeposit.amount}`);
        console.log('\n💡 Next steps:');
        console.log('   1. Check your M-Pesa STK prompt');
        console.log('   2. Verify account shows "SKYGRID TECHNOLOGIES"');
        console.log('   3. Confirm Paybill is 4046271 (not 5388069)');
        console.log('   4. Enter PIN to complete payment');
        console.log('   5. Check account balance updates within 1-2 minutes');
      } else {
        console.log('\n❌ STK Push Failed');
        console.log(`   Error: ${response.error || response.message}`);
      }
    } catch (error) {
      console.log('❌ Error parsing response:', error.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
});

req.write(postData);
req.end();
