#!/usr/bin/env node

/**
 * Direct Admin Portal Access
 * Login and get direct admin token
 */

const BACKEND_URL = 'https://betnexa-globalback.vercel.app';

async function getAdminAccess() {
  try {
    console.log('🔐 Getting admin access...\n');

    // Step 1: Try to login
    const loginResponse = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: '0714945142',
        password: '4306'
      })
    });

    const loginData = await loginResponse.json();

    if (!loginData.success) {
      console.error('❌ Login failed:', loginData.message);
      console.log('\n📝 Steps to fix:');
      console.log('1. Go to https://app.supabase.com');
      console.log('2. Open your project → SQL Editor');
      console.log('3. Run the INSERT_ADMIN_USER.sql script');
      console.log('4. Then run this script again');
      process.exit(1);
    }

    console.log('✅ Admin authenticated!\n');
    console.log('Admin Details:');
    console.log(`  ID: ${loginData.user.id}`);
    console.log(`  Name: ${loginData.user.name}`);
    console.log(`  Phone: ${loginData.user.phone}`);
    console.log(`  Level: ${loginData.user.level}`);
    console.log(`  Is Admin: ${loginData.user.isAdmin}\n`);

    // Step 2: Store credentials
    const adminToken = Buffer.from(JSON.stringify({
      id: loginData.user.id,
      phone: loginData.user.phone,
      name: loginData.user.name,
      isAdmin: loginData.user.isAdmin,
      timestamp: new Date().toISOString()
    })).toString('base64');

    console.log('🎯 Direct Admin Access Methods:\n');

    console.log('Method 1: Open Admin Portal (if already logged in on website)');
    console.log('  URL: https://betnexa.vercel.app/muleiadmin\n');

    console.log('Method 2: Login via Browser Console (copy-paste this):');
    console.log('  URL: https://betnexa.vercel.app\n');
    console.log('  Then open Browser Console (F12) and paste:\n');
    console.log(`localStorage.setItem('betnexa_user', '${JSON.stringify(loginData.user)}');`);
    console.log(`window.location.href = '/muleiadmin';\n`);

    console.log('Method 3: Admin Direct Token');
    console.log(`  Token: ${adminToken}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

getAdminAccess();
