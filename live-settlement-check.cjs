const API = 'https://betnexa-globalback.vercel.app';

async function run() {
  const phone = `+2547${Math.floor(10000000 + Math.random() * 89999999)}`;
  const password = 'Pass@1234';
  const email = `test_${Date.now()}@mail.com`;
  const result = { phone };

  const signupRes = await fetch(`${API}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'testuser',
      email,
      phone,
      password,
    }),
  });

  const signupData = await signupRes.json();
  result.signup = signupData.success;

  if (!signupData.success || !signupData.user) {
    result.signupError = signupData.message || signupData.error || 'Signup failed';
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const user = signupData.user;
  result.userId = user.id;
  result.initialAccountBalance = user.accountBalance || 0;

  const placeRes = await fetch(`${API}/api/bets/place`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: user.id,
      phoneNumber: phone,
      stake: 10,
      potentialWin: 25,
      totalOdds: 2.5,
      selections: [
        {
          matchId: 'x-m1',
          match: 'A vs B',
          market: 'DC',
          type: '1X',
          odds: 1.5,
        },
      ],
    }),
  });

  const placeData = await placeRes.json();
  result.placeBet = placeData.success;

  if (!placeData.success || !placeData.bet) {
    result.placeBetError = placeData.error || placeData.message || 'Place bet failed';
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const betId = placeData.bet.id;
  result.betId = betId;
  result.potentialWin = placeData.bet.potentialWin;

  const settleRes = await fetch(`${API}/api/bets/${betId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'Won',
      amountWon: placeData.bet.potentialWin,
    }),
  });

  const settleData = await settleRes.json();
  result.settleWon = settleData.success;
  result.updatedUser = settleData.updatedUser
    ? {
        account_balance: settleData.updatedUser.account_balance,
        winnings_balance: settleData.updatedUser.winnings_balance,
        total_winnings: settleData.updatedUser.total_winnings,
      }
    : null;

  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });

  const loginData = await loginRes.json();
  result.freshLogin = loginData.success;
  result.finalAccountBalance = loginData.user?.accountBalance;

  console.log(JSON.stringify(result, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
