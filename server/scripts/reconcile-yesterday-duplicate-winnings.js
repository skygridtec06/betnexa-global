require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const APPLY = process.argv.includes('--apply');

function asNumber(value, fallback = 0) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function getYesterdayUtcRangeForNairobi() {
  const offsetMs = 3 * 60 * 60 * 1000;
  const shiftedNow = new Date(Date.now() + offsetMs);

  const startLocal = new Date(shiftedNow);
  startLocal.setUTCHours(0, 0, 0, 0);
  startLocal.setUTCDate(startLocal.getUTCDate() - 1);

  const endLocal = new Date(startLocal);
  endLocal.setUTCDate(endLocal.getUTCDate() + 1);

  return {
    startUtc: new Date(startLocal.getTime() - offsetMs).toISOString(),
    endUtc: new Date(endLocal.getTime() - offsetMs).toISOString()
  };
}

async function fetchWonBetsCreatedInRange(startUtc, endUtc) {
  const pageSize = 1000;
  const all = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('bets')
      .select('id, bet_id, user_id, status, potential_win, created_at, updated_at, settled_at')
      .eq('status', 'Won')
      .gte('created_at', startUtc)
      .lt('created_at', endUtc)
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch yesterday created won bets: ${error.message}`);
    }

    if (!data || data.length === 0) break;
    all.push(...data);

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function fetchUser(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, phone_number, account_balance, total_winnings, total_bets')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch user ${userId}: ${error?.message || 'not found'}`);
  }

  return data;
}

async function fetchAllWonBetsForUser(userId) {
  const pageSize = 1000;
  const all = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('bets')
      .select('id, potential_win')
      .eq('user_id', userId)
      .eq('status', 'Won')
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch won bets for user ${userId}: ${error.message}`);
    }

    if (!data || data.length === 0) break;
    all.push(...data);

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function applyUserAdjustment(userId, amount) {
  const user = await fetchUser(userId);
  const currentBalance = asNumber(user.account_balance, 0);
  const currentWinnings = asNumber(user.total_winnings, 0);

  const newBalance = currentBalance - amount;
  const newWinnings = currentWinnings - amount;

  if (newBalance < 0) {
    throw new Error(
      `Refusing negative account balance for user ${userId}. ` +
      `Current balance ${currentBalance}, adjustment ${amount}`
    );
  }

  if (newWinnings < 0) {
    throw new Error(
      `Refusing negative total_winnings for user ${userId}. ` +
      `Current winnings ${currentWinnings}, adjustment ${amount}`
    );
  }

  const { error } = await supabase
    .from('users')
    .update({
      account_balance: newBalance,
      total_winnings: newWinnings,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed updating user ${userId}: ${error.message}`);
  }

  return {
    user,
    currentBalance,
    currentWinnings,
    newBalance,
    newWinnings
  };
}

async function main() {
  const { startUtc, endUtc } = getYesterdayUtcRangeForNairobi();

  console.log(`\n🧾 Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  console.log(`📅 Nairobi yesterday window (UTC): ${startUtc} -> ${endUtc}\n`);

  const yesterdayWonBets = await fetchWonBetsCreatedInRange(startUtc, endUtc);
  console.log(`Found ${yesterdayWonBets.length} yesterday-created bets currently marked Won`);

  const affectedUsers = [...new Set(yesterdayWonBets.map((b) => b.user_id).filter(Boolean))];
  console.log(`Users with yesterday wins: ${affectedUsers.length}`);

  const overcredited = [];
  for (const userId of affectedUsers) {
    const user = await fetchUser(userId);
    const allWon = await fetchAllWonBetsForUser(userId);

    const expectedWinningsFromWonBets = allWon.reduce(
      (sum, b) => sum + asNumber(b.potential_win, 0),
      0
    );

    const recordedTotalWinnings = asNumber(user.total_winnings, 0);
    const excess = recordedTotalWinnings - expectedWinningsFromWonBets;

    if (excess > 0.01) {
      overcredited.push({
        userId,
        username: user.username,
        phone: user.phone_number,
        excess,
        accountBalance: asNumber(user.account_balance, 0),
        totalWinnings: recordedTotalWinnings,
        expectedWinningsFromWonBets
      });
    }
  }

  overcredited.sort((a, b) => b.excess - a.excess);

  const totalExcess = overcredited.reduce((sum, u) => sum + u.excess, 0);
  console.log(`\n⚠️ Overcredited users in this scope: ${overcredited.length}`);
  console.log(`Total excess to reverse: KSH ${totalExcess.toFixed(2)}`);

  overcredited.slice(0, 30).forEach((u, i) => {
    console.log(
      `${i + 1}. ${u.phone || 'n/a'} (${u.userId}) | ` +
      `excess=${u.excess.toFixed(2)} | ` +
      `balance=${u.accountBalance.toFixed(2)} | ` +
      `winnings=${u.totalWinnings.toFixed(2)} | expected=${u.expectedWinningsFromWonBets.toFixed(2)}`
    );
  });

  if (!APPLY) {
    console.log('\nℹ️ Dry run complete. Re-run with --apply to execute deductions.');
    return;
  }

  const blocked = [];
  for (const item of overcredited) {
    try {
      const result = await applyUserAdjustment(item.userId, item.excess);
      console.log(
        `✅ ${result.user.phone_number || 'n/a'}: balance ${result.currentBalance} -> ${result.newBalance}, ` +
        `total_winnings ${result.currentWinnings} -> ${result.newWinnings}`
      );
    } catch (error) {
      blocked.push({ userId: item.userId, amount: item.excess, reason: error.message });
      console.warn(`⚠️ Skipped ${item.userId}: ${error.message}`);
    }
  }

  if (blocked.length > 0) {
    console.log(`\n⚠️ ${blocked.length} users were skipped by safety guards:`);
    blocked.forEach((b) => {
      console.log(`- user=${b.userId}, amount=${b.amount.toFixed(2)}, reason=${b.reason}`);
    });
    process.exitCode = 2;
  }

  console.log('\n✅ Reconciliation finished');
}

main().catch((error) => {
  console.error('\n❌ Reconciliation failed:', error.message);
  process.exit(1);
});
