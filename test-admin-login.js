#!/usr/bin/env node

/**
 * Test Admin Login
 * Directly test if backend can authenticate admin
 */

const BACKEND_URL = 'https://betnexa-globalback.vercel.app/';

async function testAdminLogin() {
  try {
    console.log('🧪 Testing admin login...\n');
    console.log('📱 Phone: 0714945142');
    console.log('🔐 Password: 4306\n');

    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: '0714945142',
        password: '4306'
      })
    });

    console.log(`Response Status: ${response.status}\n`);

    const data = await response.json();
    console.log('Response Data:');
    console.log(JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('\n✅ Login successful!');
      console.log(`Admin Name: ${data.user.name}`);
      console.log(`Is Admin: ${data.user.isAdmin}`);
      console.log(`Level: ${data.user.level}`);
    } else {
      console.log('\n❌ Login failed');
      console.log(`Error: ${data.message}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAdminLogin();
