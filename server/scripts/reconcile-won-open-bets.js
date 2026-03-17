require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const DRY_RUN = !process.argv.includes('--apply');

function asNumber(value, fallback = 0) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

async function fetchWonBets() {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  let includeAmountWon = true;

  while (true) {
    const to = from + pageSize - 1;
    const selectColumns = includeAmountWon
      ? 'id, bet_id, user_id, status, stake, potential_win, amount_won, created_at'
      : 'id, bet_id, user_id, status, stake, potential_win, created_at';

    const { data, error } = await supabase
      .from('bets')
      .select(selectColumns)
      .eq('status', 'Won')
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error && includeAmountWon && `${error.message || ''}`.includes('amount_won')) {
      includeAmountWon = false;
      from = 0;
      all.length = 0;
      continue;
    }

    if (error) throw new Error(`Failed to fetch won bets: ${error.message}`);
    if (!data || data.length === 0) break;

    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function hasPendingSelection(betId) {
  const { data, error } = await supabase
    .from('bet_selections')
    .select('id')
    .eq('bet_id', betId)
    .eq('outcome', 'pending')
    .limit(1);

  if (error) throw new Error(`Failed to fetch bet selections for ${betId}: ${error.message}`);
  return (data || []).length > 0;
}

async function fetchUser(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('id, phone_number, username, account_balance, total_winnings')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch user ${userId}: ${error?.message || 'Not found'}`);
  }

  return data;
}

async function updateBetToOpen(betId) {
  const { error } = await supabase
    .from('bets')
    .update({
      status: 'Open',
      settled_at: null,
      amount_won: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', betId)
    .eq('status', 'Won');

  if (error && `${error.message || ''}`.includes('amount_won')) {
    const fallback = await supabase
      .from('bets')
      .update({
        status: 'Open',
        settled_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', betId)
      .eq('status', 'Won');

    if (fallback.error) throw new Error(`Failed to reopen bet ${betId}: ${fallback.error.message}`);
    return;
  }

  if (error) throw new Error(`Failed to reopen bet ${betId}: ${error.message}`);
}

async function applyBalanceReversal(userId, amountToReverse) {
  const user = await fetchUser(userId);
  const currentBalance = asNumber(user.account_balance, 0);
  const currentWinnings = asNumber(user.total_winnings, 0);
  const newBalance = currentBalance - amountToReverse;
  const newWinnings = Math.max(0, currentWinnings - amountToReverse);

  if (newBalance < 0) {
    throw new Error(
      `Refusing to set negative balance for user ${userId} (${user.phone_number || 'n/a'}). ` +
      `Current=${currentBalance}, reverse=${amountToReverse}`
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

  if (error) throw new Error(`Failed updating user ${userId}: ${error.message}`);

  return {
    user,
    currentBalance,
    currentWinnings,
    newBalance,
    newWinnings
  };
}

async function main() {
  console.log(`\n🔎 Reconciliation mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY CHANGES'}\n`);

  const wonBets = await fetchWonBets();
  console.log(`Found ${wonBets.length} bets currently marked Won`);

  const flagged = [];
  for (const bet of wonBets) {
    const pendingSelection = await hasPendingSelection(bet.id);
    if (!pendingSelection) continue;

    const reverseAmount = asNumber(bet.amount_won, asNumber(bet.potential_win, 0));
    flagged.push({
      id: bet.id,
      betIdText: bet.bet_id,
      userId: bet.user_id,
      reverseAmount,
      createdAt: bet.created_at
    });
  }

  console.log(`⚠️ Found ${flagged.length} inconsistent won bets with pending selections`);

  if (flagged.length === 0) {
    console.log('✅ Nothing to reconcile');
    return;
  }

  const totalsByUser = new Map();
  for (const row of flagged) {
    totalsByUser.set(row.userId, (totalsByUser.get(row.userId) || 0) + row.reverseAmount);
  }

  const totalReversal = flagged.reduce((sum, b) => sum + b.reverseAmount, 0);
  console.log(`Total amount to reverse: KSH ${totalReversal.toFixed(2)}`);
  console.log(`Affected users: ${totalsByUser.size}`);

  console.log('\nSample affected bets (first 20):');
  flagged.slice(0, 20).forEach((b, i) => {
    console.log(
      `${i + 1}. bet_uuid=${b.id}, bet_id=${b.betIdText || 'n/a'}, user=${b.userId}, reverse=KSH ${b.reverseAmount.toFixed(2)}`
    );
  });

  if (DRY_RUN) {
    console.log('\nℹ️ Dry run only. Re-run with --apply to execute updates.');
    return;
  }

  console.log('\n🚨 Applying updates...');

  for (const row of flagged) {
    await updateBetToOpen(row.id);
  }

  const blockedUsers = [];
  for (const [userId, amount] of totalsByUser.entries()) {
    try {
      const result = await applyBalanceReversal(userId, amount);
      console.log(
        `✅ User ${userId} (${result.user.phone_number || 'n/a'}): ` +
        `balance ${result.currentBalance} -> ${result.newBalance}, ` +
        `total_winnings ${result.currentWinnings} -> ${result.newWinnings}`
      );
    } catch (error) {
      blockedUsers.push({ userId, amount, reason: error.message });
      console.warn(`⚠️ Skipped user ${userId}: ${error.message}`);
    }
  }

  if (blockedUsers.length > 0) {
    console.log(`\n⚠️ ${blockedUsers.length} users could not be fully reversed due to balance safeguards:`);
    blockedUsers.forEach((u) => {
      console.log(`- user=${u.userId}, reverse=KSH ${u.amount.toFixed(2)}, reason=${u.reason}`);
    });
    process.exitCode = 2;
  }

  console.log('\n✅ Reconciliation completed successfully');
}

main().catch((err) => {
  console.error('\n❌ Reconciliation failed:', err.message);
  process.exit(1);
});
