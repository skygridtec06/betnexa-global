import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kfoifflwbvmhxwhqyyvq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmb2lmZmx3YnZtaHh3aHF5eXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAxNDI0NjcsImV4cCI6MjAwNTcxODQ2N30.yVvxoFvhpCxM_nJVpx8rDMDsYqQvjYlLv5DTIBbNKkQ'
);

(async () => {
  console.log('Fetching users from database...\n');
  
  const { data, error } = await supabase
    .from('users')
    .select('id, phone_number, username, account_balance, total_winnings')
    .limit(15);
  
  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  if (!data || data.length === 0) {
    console.log('No users found in database');
    process.exit(1);
  }
  
  console.log(`Found ${data.length} users:\n`);
  data.forEach((u, i) => {
    console.log(`${i + 1}. ${u.username || 'N/A'}`);
    console.log(`   Phone: ${u.phone_number}`);
    console.log(`   Balance: KSH ${u.account_balance}`);
    console.log(`   Total Winnings: KSH ${u.total_winnings || 0}\n`);
  });
})().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
