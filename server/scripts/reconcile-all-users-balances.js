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

async function fetchAllRows(table, columns) {
  const pageSize = 1000;
  let from = 0;
  const all = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, to);

    if (error) throw new Error(`Failed fetching ${table}: ${error.message}`);
    if (!data || data.length === 0) break;

    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

function shouldCountWithdrawal(tx) {
  const status = `${tx.status || ''}`.toLowerCase();
  if (!status) return true;
  return !['failed', 'cancelled', 'rejected'].includes(status);
}

function shouldCountDeposit(tx) {
  const status = `${tx.status || ''}`.toLowerCase();
  return ['completed', 'success', 'successful'].includes(status);
}

async function main() {
  console.log(`\n🧾 Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`);

  const users = await fetchAllRows('users', 'id, username, phone_number, account_balance, total_winnings, total_bets');
  const bets = await fetchAllRows('bets', 'id, user_id, status, stake, potential_win');
  const transactions = await fetchAllRows('transactions', 'id, user_id, type, amount, status');

  console.log(`Loaded users=${users.length}, bets=${bets.length}, transactions=${transactions.length}`);

  const byUser = new Map();
  users.forEach((u) => {
    byUser.set(u.id, {
      user: u,
      totalStake: 0,
      totalWonBets: 0,
      totalWithdrawn: 0,
      totalDeposited: 0,
      adminCredit: 0,
      adminDebit: 0
    });
  });

  bets.forEach((b) => {
    if (!b.user_id || !byUser.has(b.user_id)) return;
    const row = byUser.get(b.user_id);
    row.totalStake += asNumber(b.stake, 0);
    if (`${b.status || ''}`.toLowerCase() === 'won') {
      row.totalWonBets += asNumber(b.potential_win, 0);
    }
  });

  transactions.forEach((tx) => {
    if (!tx.user_id || !byUser.has(tx.user_id)) return;
    const row = byUser.get(tx.user_id);
    const amount = asNumber(tx.amount, 0);
    const type = `${tx.type || ''}`.toLowerCase();

    if (type === 'withdrawal' && shouldCountWithdrawal(tx)) {
      row.totalWithdrawn += amount;
    } else if (type === 'deposit' && shouldCountDeposit(tx)) {
      row.totalDeposited += amount;
    } else if (type === 'admin_credit') {
      row.adminCredit += amount;
    } else if (type === 'admin_debit') {
      row.adminDebit += amount;
    }
  });

  const corrections = [];

  for (const [, row] of byUser.entries()) {
    const currentBalance = asNumber(row.user.account_balance, 0);
    const currentWinnings = asNumber(row.user.total_winnings, 0);

    const expectedWinnings = row.totalWonBets;
    const winningsDelta = expectedWinnings - currentWinnings;

    const modelExpectedBalance = row.totalDeposited + row.totalWonBets + row.adminCredit - row.totalStake - row.totalWithdrawn - row.adminDebit;
    const modelDrift = modelExpectedBalance - currentBalance;

    if (Math.abs(winningsDelta) > 0.01) {
      corrections.push({
        userId: row.user.id,
        phone: row.user.phone_number,
        username: row.user.username,
        currentBalance,
        currentWinnings,
        expectedWinnings,
        winningsDelta,
        totalWithdrawn: row.totalWithdrawn,
        totalStake: row.totalStake,
        totalDeposited: row.totalDeposited,
        modelExpectedBalance,
        modelDrift
      });
    }
  }

  corrections.sort((a, b) => Math.abs(b.winningsDelta) - Math.abs(a.winningsDelta));

  const positive = corrections.filter((c) => c.winningsDelta > 0).length;
  const negative = corrections.filter((c) => c.winningsDelta < 0).length;
  const totalNetDelta = corrections.reduce((s, c) => s + c.winningsDelta, 0);

  console.log(`\nUsers needing winnings/balance correction: ${corrections.length}`);
  console.log(`- Missing winnings (to add): ${positive}`);
  console.log(`- Overcredited winnings (to deduct): ${negative}`);
  console.log(`Net account balance delta to apply: KSH ${totalNetDelta.toFixed(2)}`);

  console.log('\nSample rows (first 30):');
  corrections.slice(0, 30).forEach((c, i) => {
    console.log(
      `${i + 1}. ${c.phone || 'n/a'} (${c.userId}) | ` +
      `delta=${c.winningsDelta.toFixed(2)} | ` +
      `winnings ${c.currentWinnings.toFixed(2)}->${c.expectedWinnings.toFixed(2)} | ` +
      `balance=${c.currentBalance.toFixed(2)} | withdrawn=${c.totalWithdrawn.toFixed(2)} | ` +
      `modelDrift=${c.modelDrift.toFixed(2)}`
    );
  });

  if (!APPLY) {
    console.log('\nℹ️ Dry run complete. Re-run with --apply to execute updates.');
    return;
  }

  const blocked = [];
  const floorAdjusted = [];
  for (const c of corrections) {
    let nextBalance = c.currentBalance + c.winningsDelta;
    const nextWinnings = c.expectedWinnings;

    if (nextBalance < 0) {
      floorAdjusted.push({
        userId: c.userId,
        phone: c.phone,
        requestedBalance: nextBalance,
        appliedBalance: 0,
        shortfall: Math.abs(nextBalance)
      });
      nextBalance = 0;
    }

    if (nextWinnings < 0) {
      blocked.push({ userId: c.userId, reason: `negative winnings ${nextWinnings}` });
      continue;
    }

    const { error } = await supabase
      .from('users')
      .update({
        account_balance: nextBalance,
        total_winnings: nextWinnings,
        updated_at: new Date().toISOString()
      })
      .eq('id', c.userId);

    if (error) {
      blocked.push({ userId: c.userId, reason: error.message });
      continue;
    }

    console.log(
      `✅ ${c.phone || 'n/a'}: balance ${c.currentBalance.toFixed(2)} -> ${nextBalance.toFixed(2)}, ` +
      `total_winnings ${c.currentWinnings.toFixed(2)} -> ${nextWinnings.toFixed(2)}`
    );
  }

  if (blocked.length > 0) {
    console.log(`\n⚠️ ${blocked.length} users were skipped:`);
    blocked.forEach((b) => console.log(`- ${b.userId}: ${b.reason}`));
    process.exitCode = 2;
  }

  if (floorAdjusted.length > 0) {
    console.log(`\n⚠️ ${floorAdjusted.length} users required balance floor adjustment to 0 due to prior spend/withdrawal:`);
    floorAdjusted.forEach((u) => {
      console.log(
        `- ${u.phone || 'n/a'} (${u.userId}): ` +
        `requested_balance=${u.requestedBalance.toFixed(2)}, applied_balance=0.00, shortfall=${u.shortfall.toFixed(2)}`
      );
    });
  }

  console.log('\n✅ All-user reconciliation complete');
}

main().catch((error) => {
  console.error('\n❌ Reconciliation failed:', error.message);
  process.exit(1);
});
