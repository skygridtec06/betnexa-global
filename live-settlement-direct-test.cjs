require('dotenv').config({ path: './server/.env' });
const { createClient } = require('@supabase/supabase-js');

const API = 'https://server-tau-puce.vercel.app';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY);

async function run() {
  const phone = `+2547${Math.floor(10000000 + Math.random() * 89999999)}`;
  const password = 'Pass@1234';
  const email = `verify_${Date.now()}@mail.com`;
  const fallbackPhone = '+254792967252';
  const result = { phone };

  const signupRes = await fetch(`${API}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'verifyuser', email, phone, password }),
  });
  const signupData = await signupRes.json();
  result.signup = signupData.success;

  let userId = signupData?.user?.id;
  let loginPhone = phone;

  if (!signupData.success || !signupData.user) {
    const fallbackLoginRes = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: fallbackPhone, password }),
    });
    const fallbackLoginData = await fallbackLoginRes.json();
    if (!fallbackLoginData.success || !fallbackLoginData.user) {
      result.error = signupData.message || signupData.error || 'Signup failed';
      result.fallbackLoginError = fallbackLoginData.message || fallbackLoginData.error || 'Fallback login failed';
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    userId = fallbackLoginData.user.id;
    loginPhone = fallbackPhone;
    result.usedFallbackLogin = true;
  }

  result.userId = userId;

  const now = new Date();
  const potentialWin = 55;

  const { data: bet, error: betError } = await supabase
    .from('bets')
    .insert({
      bet_id: `TST${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      user_id: userId,
      stake: 10,
      potential_win: potentialWin,
      total_odds: 5.5,
      status: 'Open',
      bet_date: `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`,
      bet_time: `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`,
      created_at: now.toISOString(),
    })
    .select('id, status, potential_win')
    .single();

  if (betError || !bet) {
    result.error = betError?.message || 'Bet insert failed';
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  result.testBetId = bet.id;

  const settleRes = await fetch(`${API}/api/bets/${bet.id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Won', amountWon: potentialWin }),
  });

  const settleData = await settleRes.json();
  result.settleResponse = settleData;
  result.settleSuccess = settleData.success;
  result.updatedUserFromSettle = settleData.updatedUser
    ? {
        account_balance: settleData.updatedUser.account_balance,
        total_winnings: settleData.updatedUser.total_winnings,
      }
    : null;

  const { data: dbUser, error: dbUserError } = await supabase
    .from('users')
    .select('account_balance, total_winnings')
    .eq('id', userId)
    .single();

  result.dbUser = dbUserError ? { error: dbUserError.message } : dbUser;

  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: loginPhone, password }),
  });
  const loginData = await loginRes.json();

  result.freshLoginSuccess = loginData.success;
  result.freshLoginAccountBalance = loginData.user?.accountBalance;

  console.log(JSON.stringify(result, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
