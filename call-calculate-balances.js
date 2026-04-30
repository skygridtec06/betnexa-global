const API_URL = 'https://betnexa-globalback.vercel.app/api/admin/calculate-user-balances';
const ADMIN_PHONE = '0799880000'; // This should be the admin phone number

async function calculateUserBalances() {
  try {
    console.log('📡 Calling calculate-user-balances API...');
    console.log(`   URL: ${API_URL}`);
    console.log(`   Admin Phone: ${ADMIN_PHONE}\n`);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone: ADMIN_PHONE })
    });

    const data = await response.json();

    if (data.success) {
      console.log('\n✅ SUCCESS: Balance calculation completed!\n');
      console.log(`Updated: ${data.updatedCount}/${data.totalCount} users`);
      console.log(`Failed: ${data.failed} users\n`);

      console.log('📊 Summary:');
      console.log('='.repeat(80));

      if (data.summary && data.summary.length > 0) {
        data.summary.forEach((item) => {
          const diff = item.difference > 0 ? `+${item.difference}` : item.difference;
          console.log(`${item.email}`);
          console.log(`  Old: KSH ${item.oldBalance} → New: KSH ${item.newBalance} (${diff})`);
        });
      }

      console.log('='.repeat(80));
      console.log('\n📋 Detailed Information:');
      if (data.details && data.details.length > 0) {
        data.details.forEach((detail) => {
          console.log(`\n${detail.email}:`);
          console.log(`  Won Bets: ${detail.wonBets} | Total Won: KSH ${detail.won}`);
          console.log(`  Lost Bets: ${detail.lostBets} | Total Lost: KSH ${detail.lost}`);
          console.log(`  Open Bets: ${detail.openBets} | Total At Risk: KSH ${detail.open}`);
          console.log(`  Balance: KSH ${detail.oldBalance} → KSH ${detail.newBalance}`);
        });
      }
    } else {
      console.error('❌ API returned error:', data);
    }
  } catch (error) {
    console.error('❌ Error calling API:');
    console.error('   Message:', error.message);
  }
}

calculateUserBalances();
