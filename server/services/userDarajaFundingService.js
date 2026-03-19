/**
 * User Daraja Funding Service
 * Handles creating pending DB records and idempotent balance credit
 * for user deposits, activation fees, and priority fees via Daraja (M-Pesa direct).
 */
const supabase = require('./database');
const paymentCache = require('./paymentCache');

function nowIso() {
  return new Date().toISOString();
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Register a user Daraja STK attempt: create pending transaction + fund_transfers records.
 * paymentType: 'deposit' | 'activation' | 'priority'
 */
async function registerUserDarajaAttempt({
  userId,
  phoneNumber,
  amount,
  externalReference,
  checkoutRequestId,
  merchantRequestId,
  paymentType = 'deposit',
  relatedWithdrawalId,
}) {
  if (!supabase || !userId || !checkoutRequestId) {
    return { success: false, error: 'Missing required parameters (userId, checkoutRequestId)' };
  }

  if (!UUID_REGEX.test(userId)) {
    return { success: false, error: `Invalid userId: ${userId}` };
  }

  const timestamp = nowIso();
  const depositAmount = parseFloat(amount);

  // Check for existing transaction by checkoutRequestId (idempotency)
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, user_id, amount, status, external_reference, checkout_request_id')
    .eq('checkout_request_id', checkoutRequestId)
    .maybeSingle();

  if (existing) {
    // Re-store in cache in case it was lost
    paymentCache.storePayment(externalReference, checkoutRequestId, {
      type: `USER_DARAJA_${paymentType.toUpperCase()}`,
      amount: depositAmount,
      phone_number: phoneNumber,
      user_id: userId,
      payment_type: paymentType,
      external_reference: externalReference,
      related_withdrawal_id: relatedWithdrawalId,
      merchantRequestId,
    });
    return { success: true, transaction: existing };
  }

  // Fetch current balance for balance_before / balance_after
  const { data: userRow } = await supabase
    .from('users')
    .select('account_balance')
    .eq('id', userId)
    .maybeSingle();

  const currentBalance = parseFloat(userRow?.account_balance) || 0;

  const methodLabel =
    paymentType === 'activation' ? 'Withdrawal Activation (Daraja)'
    : paymentType === 'priority'   ? 'Priority Fee (Daraja)'
    : 'M-Pesa (Daraja)';

  const description =
    paymentType === 'activation' ? 'Withdrawal activation fee via Daraja - pending'
    : paymentType === 'priority'   ? 'Priority withdrawal fee via Daraja - pending'
    : 'M-Pesa deposit via Daraja - pending';

  const insertPayload = {
    transaction_id: `DUSER-${Date.now()}-${externalReference}`,
    user_id: userId,
    type: 'deposit',
    amount: depositAmount,
    status: 'pending',
    method: methodLabel,
    phone_number: phoneNumber,
    external_reference: externalReference,
    checkout_request_id: checkoutRequestId,
    description,
    balance_before: currentBalance,
    balance_after: currentBalance + depositAmount,
    created_at: timestamp,
    updated_at: timestamp,
  };

  let { data: inserted, error: insertError } = await supabase
    .from('transactions')
    .insert(insertPayload)
    .select('id, user_id, amount, status, external_reference, checkout_request_id')
    .single();

  if (insertError) {
    console.warn('[registerUserDarajaAttempt] Insert failed, retrying without balance fields:', insertError.message);
    const minimal = {
      transaction_id: insertPayload.transaction_id,
      user_id: userId,
      type: 'deposit',
      amount: depositAmount,
      status: 'pending',
      method: methodLabel,
      phone_number: phoneNumber,
      external_reference: externalReference,
      checkout_request_id: checkoutRequestId,
      description,
      created_at: timestamp,
      updated_at: timestamp,
    };
    const retry = await supabase
      .from('transactions')
      .insert(minimal)
      .select('id, user_id, amount, status, external_reference, checkout_request_id')
      .single();
    if (retry.error) {
      return { success: false, error: retry.error.message || 'Failed to create transaction record' };
    }
    inserted = retry.data;
  }

  // fund_transfers record (fire & forget, non-blocking)
  supabase.from('fund_transfers').insert({
    user_id: userId,
    transaction_id: inserted.id,
    transfer_type: 'deposit',
    amount: depositAmount,
    phone_number: phoneNumber,
    status: 'pending',
    method: methodLabel,
    external_reference: externalReference,
    checkout_request_id: checkoutRequestId,
    is_stk_push_sent: true,
    stk_sent_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
  }).then(({ error }) => {
    if (error) console.warn('[registerUserDarajaAttempt] fund_transfers warning:', error.message);
  });

  // Cache for status polling lookup
  paymentCache.storePayment(externalReference, checkoutRequestId, {
    type: `USER_DARAJA_${paymentType.toUpperCase()}`,
    amount: depositAmount,
    phone_number: phoneNumber,
    user_id: userId,
    payment_type: paymentType,
    external_reference: externalReference,
    related_withdrawal_id: relatedWithdrawalId,
    merchantRequestId,
  });

  return { success: true, transaction: inserted };
}

/**
 * Idempotently credit a user's balance for a successful Daraja payment.
 * Called from status polling endpoint AND from the Daraja callback.
 */
async function ensureUserDarajaFunding({
  checkoutRequestId,
  mpesaReceipt,
  resultCode,
  resultDesc,
  amount,
  phoneNumber,
}) {
  if (!supabase || !checkoutRequestId) {
    return { success: false, error: 'Missing supabase or checkoutRequestId' };
  }

  // Find transaction record
  let transaction = null;

  const { data: existing } = await supabase
    .from('transactions')
    .select('id, user_id, amount, status, external_reference, checkout_request_id, phone_number')
    .eq('checkout_request_id', checkoutRequestId)
    .maybeSingle();

  if (existing) {
    transaction = existing;
  } else {
    // Try cache fallback
    const cached = paymentCache.getPayment(checkoutRequestId);
    if (!cached || !cached.user_id) {
      return { success: false, error: 'User Daraja payment record not found in DB or cache' };
    }
    const reg = await registerUserDarajaAttempt({
      userId: cached.user_id,
      phoneNumber: cached.phone_number || phoneNumber,
      amount: cached.amount || amount,
      externalReference: cached.external_reference || cached.externalReference,
      checkoutRequestId,
      merchantRequestId: cached.merchantRequestId,
      paymentType: cached.payment_type || 'deposit',
    });
    if (!reg.success) return reg;
    transaction = reg.transaction;
  }

  if (!transaction) {
    return { success: false, error: 'Transaction could not be prepared' };
  }

  // Already done? Return safely
  if (transaction.status === 'completed') {
    const { data: u } = await supabase
      .from('users').select('account_balance').eq('id', transaction.user_id).maybeSingle();
    return {
      success: true,
      alreadyProcessed: true,
      creditedAmount: parseFloat(transaction.amount) || 0,
      newBalance: parseFloat(u?.account_balance) || 0,
      userId: transaction.user_id,
    };
  }

  const timestamp = nowIso();

  // Atomic claim: only succeeds once (pending → completed)
  const { data: updatedRows, error: completeError } = await supabase
    .from('transactions')
    .update({
      status: 'completed',
      mpesa_receipt: mpesaReceipt || null,
      description: 'M-Pesa Daraja payment credited',
      completed_at: timestamp,
      updated_at: timestamp,
    })
    .eq('id', transaction.id)
    .eq('status', 'pending')
    .select('id, user_id, amount, external_reference, phone_number');

  if (completeError) {
    return { success: false, error: completeError.message };
  }

  if (!updatedRows || updatedRows.length === 0) {
    // Already processed by another request
    const { data: u } = await supabase
      .from('users').select('account_balance').eq('id', transaction.user_id).maybeSingle();
    return {
      success: true,
      alreadyProcessed: true,
      creditedAmount: parseFloat(transaction.amount) || 0,
      newBalance: parseFloat(u?.account_balance) || 0,
      userId: transaction.user_id,
    };
  }

  const completedTx = updatedRows[0];

  // Fetch user for balance update
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('account_balance, username')
    .eq('id', completedTx.user_id)
    .single();

  if (userError || !user) {
    // Roll back transaction status
    await supabase.from('transactions')
      .update({ status: 'pending', completed_at: null, updated_at: nowIso() })
      .eq('id', completedTx.id);
    return { success: false, error: userError?.message || 'User not found for balance credit' };
  }

  const previousBalance = parseFloat(user.account_balance) || 0;
  const creditedAmount = parseFloat(completedTx.amount) || 0;
  const newBalance = previousBalance + creditedAmount;

  // Read payment type from cache to decide activation
  const cached = paymentCache.getPayment(checkoutRequestId);
  const paymentType = cached?.payment_type || 'deposit';

  const userUpdate = { account_balance: newBalance, updated_at: nowIso() };
  if (paymentType === 'activation') {
    userUpdate.withdrawal_activated = true;
    userUpdate.withdrawal_activation_date = timestamp;
  }

  const { error: balanceError } = await supabase
    .from('users')
    .update(userUpdate)
    .eq('id', completedTx.user_id);

  if (balanceError) {
    // Roll back transaction status
    await supabase.from('transactions')
      .update({ status: 'pending', completed_at: null, updated_at: nowIso() })
      .eq('id', completedTx.id);
    return { success: false, error: balanceError.message };
  }

  // Update fund_transfers (fire & forget)
  supabase.from('fund_transfers')
    .update({ status: 'completed', completed_at: timestamp, updated_at: timestamp, mpesa_receipt: mpesaReceipt || null })
    .eq('checkout_request_id', checkoutRequestId)
    .eq('status', 'pending')
    .then(({ error }) => { if (error) console.warn('[ensureUserDarajaFunding] fund_transfers update warning:', error.message); });

  // Log to balance_history (fire & forget)
  supabase.from('balance_history').insert({
    user_id: completedTx.user_id,
    transaction_id: completedTx.id,
    amount: creditedAmount,
    balance_before: previousBalance,
    balance_after: newBalance,
    type: paymentType,
    description: `Daraja ${paymentType} funded`,
    created_at: timestamp,
  }).then(({ error }) => { if (error) console.warn('[ensureUserDarajaFunding] balance_history warning:', error.message); });

  console.log(`✅ [ensureUserDarajaFunding] User ${completedTx.user_id} credited KSH ${creditedAmount} (${paymentType}). New balance: ${newBalance}`);

  return {
    success: true,
    alreadyProcessed: false,
    creditedAmount,
    previousBalance,
    newBalance,
    activationEnabled: paymentType === 'activation',
    externalReference: completedTx.external_reference,
    userId: completedTx.user_id,
    mpesaReceipt,
  };
}

/**
 * Persist terminal (non-success) status for a user Daraja attempt.
 * Ensures failed/cancelled attempts are not left as pending.
 */
async function persistUserDarajaTerminalStatus({
  checkoutRequestId,
  status,
  resultCode,
  resultDesc,
  mpesaReceipt,
  amount,
  phoneNumber,
}) {
  if (!supabase || !checkoutRequestId) {
    return { success: false, error: 'Missing supabase or checkoutRequestId' };
  }

  const normalized = `${status || ''}`.toLowerCase();
  if (!['failed', 'cancelled'].includes(normalized)) {
    return { success: true, skipped: true, reason: 'non-terminal or unsupported status' };
  }

  let transaction = null;

  const { data: existing } = await supabase
    .from('transactions')
    .select('id, user_id, amount, status, external_reference, checkout_request_id, phone_number')
    .eq('checkout_request_id', checkoutRequestId)
    .maybeSingle();

  if (existing) {
    transaction = existing;
  } else {
    const cached = paymentCache.getPayment(checkoutRequestId);
    if (cached?.user_id) {
      const reg = await registerUserDarajaAttempt({
        userId: cached.user_id,
        phoneNumber: cached.phone_number || phoneNumber,
        amount: cached.amount || amount,
        externalReference: cached.external_reference || cached.externalReference,
        checkoutRequestId,
        merchantRequestId: cached.merchantRequestId,
        paymentType: cached.payment_type || 'deposit',
        relatedWithdrawalId: cached.related_withdrawal_id,
      });
      if (!reg.success) return reg;
      transaction = reg.transaction;
    }
  }

  if (!transaction) {
    return { success: false, error: 'User Daraja payment record not found in DB or cache' };
  }

  if (transaction.status === 'completed') {
    return { success: true, skipped: true, reason: 'already completed' };
  }

  const timestamp = nowIso();
  const description = normalized === 'cancelled'
    ? `M-Pesa Daraja payment cancelled${resultDesc ? `: ${resultDesc}` : ''}`
    : `M-Pesa Daraja payment failed${resultDesc ? `: ${resultDesc}` : ''}`;

  const { error: txError } = await supabase
    .from('transactions')
    .update({
      status: normalized,
      mpesa_receipt: mpesaReceipt || null,
      description,
      result_code: resultCode ?? null,
      result_desc: resultDesc || null,
      completed_at: timestamp,
      updated_at: timestamp,
    })
    .eq('id', transaction.id)
    .in('status', ['pending', 'failed', 'cancelled']);

  if (txError) {
    return { success: false, error: txError.message };
  }

  supabase.from('fund_transfers')
    .update({
      status: normalized,
      mpesa_receipt: mpesaReceipt || null,
      result_code: resultCode ?? null,
      result_description: resultDesc || null,
      completed_at: timestamp,
      updated_at: timestamp,
    })
    .eq('checkout_request_id', checkoutRequestId)
    .in('status', ['pending', 'failed', 'cancelled'])
    .then(({ error }) => {
      if (error) console.warn('[persistUserDarajaTerminalStatus] fund_transfers warning:', error.message);
    });

  return {
    success: true,
    status: normalized,
    userId: transaction.user_id,
    transactionId: transaction.id,
  };
}

module.exports = {
  registerUserDarajaAttempt,
  ensureUserDarajaFunding,
  persistUserDarajaTerminalStatus,
};
