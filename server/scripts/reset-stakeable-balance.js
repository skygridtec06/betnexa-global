require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const APPLY = process.argv.includes('--apply');
const DEPOSIT_ONLY_STAKING_START = process.env.DEPOSIT_ONLY_STAKING_START || '2026-03-17T09:47:00.000Z';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function asNumber(value, fallback = 0) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

async function fetchUsers() {
  const users = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('users')
      .select('id, username, phone_number')
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    users.push(...data);
    if (data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return users;
}

async function getStakeableDepositBalance(userId, startIso) {
  const { data: depositTransactions, error: txError } = await supabase
    .from('transactions')
    .select('amount, external_reference')
    .eq('user_id', userId)
    .eq('type', 'deposit')
    .eq('status', 'completed')
    .gte('created_at', startIso);

  if (txError) {
    throw new Error(`Failed to fetch completed deposit transactions: ${txError.message}`);
  }

  const { data: deposits, error: depError } = await supabase
    .from('deposits')
    .select('amount, external_reference')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('created_at', startIso);

  if (depError) {
    throw new Error(`Failed to fetch completed deposits: ${depError.message}`);
  }

  const { data: bets, error: betError } = await supabase
    .from('bets')
    .select('stake')
    .eq('user_id', userId)
    .gte('created_at', startIso);

  if (betError) {
    throw new Error(`Failed to fetch placed bets: ${betError.message}`);
  }

  const seenRefs = new Set(
    (depositTransactions || [])
      .map((tx) => tx.external_reference)
      .filter(Boolean)
  );

  const transactionDepositsTotal = (depositTransactions || []).reduce(
    (sum, tx) => sum + asNumber(tx.amount, 0),
    0
  );

  const depositsTableTotal = (deposits || [])
    .filter((dep) => !dep.external_reference || !seenRefs.has(dep.external_reference))
    .reduce((sum, dep) => sum + asNumber(dep.amount, 0), 0);

  const stakesTotal = (bets || []).reduce((sum, bet) => sum + asNumber(bet.stake, 0), 0);
  const completedDepositsTotal = transactionDepositsTotal + depositsTableTotal;

  return Math.max(0, completedDepositsTotal - stakesTotal);
}

async function main() {
  console.log(`\n🧮 Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Cutoff start (UTC): ${new Date(DEPOSIT_ONLY_STAKING_START).toISOString()}`);
  console.log('Goal: Audit stakeable balances derived from post-cutoff deposits only.\n');

  const users = await fetchUsers();
  const startIso = new Date(DEPOSIT_ONLY_STAKING_START).toISOString();
  const usersWithStakeable = [];

  for (const user of users) {
    const availableToBet = await getStakeableDepositBalance(user.id, startIso);
    if (availableToBet > 0) {
      usersWithStakeable.push({
        ...user,
        availableToBet
      });
    }
  }

  console.log(`Total users: ${users.length}`);
  console.log(`Users with available_to_bet > 0: ${usersWithStakeable.length}`);

  if (usersWithStakeable.length > 0) {
    console.log('\nSample affected users (first 20):');
    usersWithStakeable.slice(0, 20).forEach((u, idx) => {
      console.log(`${idx + 1}. ${u.username || 'n/a'} (${u.phone_number || 'n/a'}) | available_to_bet=${u.availableToBet}`);
    });
  }

  if (!APPLY) {
    console.log('\nℹ️ Dry run complete. Re-run with --apply to confirm operational mode.');
    return;
  }

  console.log('\n✅ No direct DB update required. Stakeable balance is now enforced by post-cutoff deposit history logic.');
}

main().catch((error) => {
  console.error('\n❌ Script failed:', error.message);
  process.exit(1);
});
