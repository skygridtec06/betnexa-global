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
const DEFAULT_START = '2026-03-10T21:00:00.000Z'; // 2026-03-11 00:00:00 (UTC+3)
const START = process.env.RECON_START_DATE_UTC || DEFAULT_START;

function asNumber(value, fallback = 0) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isOnOrAfterStart(value, startDate) {
  const d = parseDate(value);
  if (!d) return false;
  return d.getTime() >= startDate.getTime();
}

async function fetchPaged(table, columns, pageFilterBuilder) {
  const all = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    let query = supabase.from(table).select(columns).range(from, to);
    if (pageFilterBuilder) {
      query = pageFilterBuilder(query);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed fetching ${table}: ${error.message}`);
    if (!data || data.length === 0) break;

    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

function isCompletedDeposit(tx) {
  const type = `${tx.type || ''}`.toLowerCase();
  const status = `${tx.status || ''}`.toLowerCase();
  if (type !== 'deposit') return false;
  return ['completed', 'success', 'successful'].includes(status);
}

function isEffectiveWithdrawal(tx) {
  const type = `${tx.type || ''}`.toLowerCase();
  const status = `${tx.status || ''}`.toLowerCase();
  if (type !== 'withdrawal') return false;
  return !['failed', 'cancelled', 'rejected'].includes(status);
}

async function main() {
  const startDate = new Date(START);
  if (Number.isNaN(startDate.getTime())) {
    throw new Error(`Invalid RECON_START_DATE_UTC: ${START}`);
  }

  console.log(`\n🧮 Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  console.log(`📅 Scope start (UTC): ${startDate.toISOString()}`);
  console.log('Formula: (Completed Deposit + Winnings) - (Total Stake + Withdrawn)\n');

  const users = await fetchPaged(
    'users',
    'id, username, phone_number, created_at, account_balance, total_winnings',
    (q) => q.gte('created_at', startDate.toISOString())
  );

  const userIds = new Set(users.map((u) => u.id));
  if (userIds.size === 0) {
    console.log('No users found from date 11 scope.');
    return;
  }

  const bets = await fetchPaged(
    'bets',
    'id, user_id, status, stake, potential_win, created_at, settled_at, updated_at',
    (q) => q.gte('created_at', startDate.toISOString())
  );

  const transactions = await fetchPaged(
    'transactions',
    'id, user_id, type, amount, status, created_at, external_reference',
    (q) => q.gte('created_at', startDate.toISOString())
  );

  const deposits = await fetchPaged(
    'deposits',
    'id, user_id, amount, status, created_at, completed_at, external_reference',
    (q) => q.gte('created_at', startDate.toISOString())
  );

  const perUser = new Map();
  users.forEach((u) => {
    perUser.set(u.id, {
      user: u,
      depositsCompleted: 0,
      winningsFromWonBets: 0,
      totalStake: 0,
      withdrawn: 0
    });
  });

  for (const b of bets) {
    if (!b.user_id || !perUser.has(b.user_id)) continue;

    const rec = perUser.get(b.user_id);
    rec.totalStake += asNumber(b.stake, 0);

    if (`${b.status || ''}`.toLowerCase() === 'won') {
      const winEventTime = b.settled_at || b.updated_at || b.created_at;
      if (isOnOrAfterStart(winEventTime, startDate)) {
        rec.winningsFromWonBets += asNumber(b.potential_win, 0);
      }
    }
  }

  for (const tx of transactions) {
    if (!tx.user_id || !perUser.has(tx.user_id)) continue;
    const rec = perUser.get(tx.user_id);

    if (isCompletedDeposit(tx)) {
      rec.depositsCompleted += asNumber(tx.amount, 0);
    }

    if (isEffectiveWithdrawal(tx)) {
      rec.withdrawn += asNumber(tx.amount, 0);
    }
  }

  const completedDepositRefsInTransactions = new Set(
    transactions
      .filter((tx) => isCompletedDeposit(tx) && tx.external_reference)
      .map((tx) => tx.external_reference)
  );

  for (const dep of deposits) {
    if (!dep.user_id || !perUser.has(dep.user_id)) continue;
    if (`${dep.status || ''}`.toLowerCase() !== 'completed') continue;

    const depEffectiveDate = dep.completed_at || dep.created_at;
    if (!isOnOrAfterStart(depEffectiveDate, startDate)) continue;

    if (dep.external_reference && completedDepositRefsInTransactions.has(dep.external_reference)) {
      continue;
    }

    const rec = perUser.get(dep.user_id);
    rec.depositsCompleted += asNumber(dep.amount, 0);
  }

  const rows = [];
  for (const rec of perUser.values()) {
    const currentBalance = asNumber(rec.user.account_balance, 0);
    const currentWinnings = asNumber(rec.user.total_winnings, 0);

    const expectedBalance = rec.depositsCompleted + rec.winningsFromWonBets - rec.totalStake - rec.withdrawn;
    const balanceDelta = expectedBalance - currentBalance;

    const expectedWinnings = rec.winningsFromWonBets;
    const winningsDelta = expectedWinnings - currentWinnings;

    if (Math.abs(balanceDelta) > 0.01 || Math.abs(winningsDelta) > 0.01) {
      rows.push({
        userId: rec.user.id,
        phone: rec.user.phone_number,
        username: rec.user.username,
        currentBalance,
        expectedBalance,
        balanceDelta,
        currentWinnings,
        expectedWinnings,
        winningsDelta,
        depositsCompleted: rec.depositsCompleted,
        totalStake: rec.totalStake,
        withdrawn: rec.withdrawn
      });
    }
  }

  rows.sort((a, b) => Math.abs(b.balanceDelta) - Math.abs(a.balanceDelta));

  console.log(`Users in scope: ${users.length}`);
  console.log(`Users needing updates: ${rows.length}`);
  console.log(`Net balance delta: KSH ${rows.reduce((s, r) => s + r.balanceDelta, 0).toFixed(2)}`);

  console.log('\nSample updates (first 25):');
  rows.slice(0, 25).forEach((r, i) => {
    console.log(
      `${i + 1}. ${r.phone || 'n/a'} (${r.userId}) | ` +
      `balance ${r.currentBalance.toFixed(2)} -> ${r.expectedBalance.toFixed(2)} (Δ ${r.balanceDelta.toFixed(2)}) | ` +
      `winnings ${r.currentWinnings.toFixed(2)} -> ${r.expectedWinnings.toFixed(2)} | ` +
      `dep=${r.depositsCompleted.toFixed(2)}, stake=${r.totalStake.toFixed(2)}, wd=${r.withdrawn.toFixed(2)}`
    );
  });

  if (!APPLY) {
    console.log('\nℹ️ Dry run complete. Re-run with --apply to execute updates.');
    return;
  }

  for (const r of rows) {
    const { error } = await supabase
      .from('users')
      .update({
        account_balance: r.expectedBalance,
        total_winnings: r.expectedWinnings,
        updated_at: new Date().toISOString()
      })
      .eq('id', r.userId);

    if (error) {
      console.warn(`⚠️ Failed ${r.userId}: ${error.message}`);
      continue;
    }

    console.log(
      `✅ ${r.phone || 'n/a'}: balance ${r.currentBalance.toFixed(2)} -> ${r.expectedBalance.toFixed(2)}, ` +
      `winnings ${r.currentWinnings.toFixed(2)} -> ${r.expectedWinnings.toFixed(2)}`
    );
  }

  console.log('\n✅ Date-11 reconciliation complete');
}

main().catch((error) => {
  console.error('\n❌ Reconciliation failed:', error.message);
  process.exit(1);
});
