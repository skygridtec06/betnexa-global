const supabase = require('./database');
const paymentCache = require('./paymentCache');

function nowIso() {
  return new Date().toISOString();
}

async function registerAdminDarajaTestAttempt({
  adminUserId,
  adminPhone,
  amount,
  phoneNumber,
  externalReference,
  checkoutRequestId,
  merchantRequestId,
}) {
  if (!supabase || !adminUserId || !checkoutRequestId) {
    return { success: false, error: 'Missing Supabase, admin user, or checkout request ID' };
  }

  const timestamp = nowIso();

  let transaction = null;
  const { data: existingTransaction } = await supabase
    .from('transactions')
    .select('id, user_id, amount, status, external_reference, checkout_request_id')
    .eq('checkout_request_id', checkoutRequestId)
    .maybeSingle();

  if (existingTransaction) {
    transaction = existingTransaction;
  } else {
    const insertPayload = {
      transaction_id: `ADT-${Date.now()}-${externalReference}`,
      user_id: adminUserId,
      type: 'deposit',
      amount: parseFloat(amount),
      status: 'pending',
      method: 'Daraja Admin Test',
      phone_number: phoneNumber,
      external_reference: externalReference,
      checkout_request_id: checkoutRequestId,
      description: 'Admin Daraja test deposit - pending',
      created_at: timestamp,
      updated_at: timestamp,
    };

    const { data: insertedTransaction, error: transactionError } = await supabase
      .from('transactions')
      .insert(insertPayload)
      .select('id, user_id, amount, status, external_reference, checkout_request_id')
      .single();

    if (transactionError) {
      return { success: false, error: transactionError.message || 'Failed to create admin Daraja test transaction' };
    }

    transaction = insertedTransaction;
  }

  const { data: existingTransfer } = await supabase
    .from('fund_transfers')
    .select('id')
    .eq('checkout_request_id', checkoutRequestId)
    .maybeSingle();

  if (!existingTransfer) {
    await supabase.from('fund_transfers').insert({
      user_id: adminUserId,
      transaction_id: transaction.id,
      transfer_type: 'deposit',
      amount: parseFloat(amount),
      phone_number: phoneNumber,
      status: 'pending',
      method: 'Daraja Admin Test',
      external_reference: externalReference,
      checkout_request_id: checkoutRequestId,
      is_stk_push_sent: true,
      stk_sent_at: timestamp,
      admin_notes: `Admin Daraja test initiated by ${adminPhone || adminUserId}`,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  paymentCache.storePayment(externalReference, checkoutRequestId, {
    type: 'ADMIN_DARAJA_TEST',
    amount: parseFloat(amount),
    phone_number: phoneNumber,
    merchantRequestId,
    external_reference: externalReference,
    admin_user_id: adminUserId,
    admin_phone: adminPhone,
  });

  return { success: true, transaction };
}

async function ensureAdminDarajaTestFunding({
  checkoutRequestId,
  mpesaReceipt,
  resultCode,
  resultDesc,
  amount,
  phoneNumber,
}) {
  if (!supabase || !checkoutRequestId) {
    return { success: false, error: 'Missing Supabase or checkout request ID' };
  }

  let transaction = null;

  const { data: existingTransaction } = await supabase
    .from('transactions')
    .select('id, user_id, amount, status, external_reference, checkout_request_id, phone_number, mpesa_receipt')
    .eq('checkout_request_id', checkoutRequestId)
    .maybeSingle();

  if (existingTransaction) {
    transaction = existingTransaction;
  } else {
    const cachedPayment = paymentCache.getPayment(checkoutRequestId);
    if (!cachedPayment || cachedPayment.type !== 'ADMIN_DARAJA_TEST') {
      return { success: false, error: 'Admin Daraja test payment not found' };
    }

    const registerResult = await registerAdminDarajaTestAttempt({
      adminUserId: cachedPayment.admin_user_id,
      adminPhone: cachedPayment.admin_phone,
      amount: cachedPayment.amount || amount,
      phoneNumber: cachedPayment.phone_number || phoneNumber,
      externalReference: cachedPayment.external_reference || cachedPayment.externalReference,
      checkoutRequestId,
      merchantRequestId: cachedPayment.merchantRequestId,
    });

    if (!registerResult.success) {
      return registerResult;
    }

    transaction = registerResult.transaction;
  }

  if (!transaction) {
    return { success: false, error: 'Admin Daraja test transaction could not be prepared' };
  }

  if (transaction.status === 'completed') {
    const { data: currentUser } = await supabase
      .from('users')
      .select('account_balance')
      .eq('id', transaction.user_id)
      .maybeSingle();

    return {
      success: true,
      alreadyProcessed: true,
      creditedAmount: parseFloat(transaction.amount) || 0,
      newBalance: parseFloat(currentUser?.account_balance) || 0,
      externalReference: transaction.external_reference,
      userId: transaction.user_id,
    };
  }

  const timestamp = nowIso();
  const { data: updatedRows, error: completeError } = await supabase
    .from('transactions')
    .update({
      status: 'completed',
      mpesa_receipt: mpesaReceipt || transaction.mpesa_receipt || null,
      description: 'Admin Daraja test deposit funded',
      completed_at: timestamp,
      updated_at: timestamp,
    })
    .eq('id', transaction.id)
    .eq('status', 'pending')
    .select('id, user_id, amount, external_reference, phone_number');

  if (completeError) {
    return { success: false, error: completeError.message || 'Failed to finalize admin Daraja test transaction' };
  }

  if (!updatedRows || updatedRows.length === 0) {
    const { data: currentUser } = await supabase
      .from('users')
      .select('account_balance')
      .eq('id', transaction.user_id)
      .maybeSingle();

    return {
      success: true,
      alreadyProcessed: true,
      creditedAmount: parseFloat(transaction.amount) || 0,
      newBalance: parseFloat(currentUser?.account_balance) || 0,
      externalReference: transaction.external_reference,
      userId: transaction.user_id,
    };
  }

  const completedTransaction = updatedRows[0];

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('account_balance, username')
    .eq('id', completedTransaction.user_id)
    .single();

  if (userError || !user) {
    await supabase
      .from('transactions')
      .update({ status: 'pending', description: 'Admin Daraja test deposit - pending', completed_at: null, updated_at: nowIso() })
      .eq('id', completedTransaction.id)
      .eq('status', 'completed');

    return { success: false, error: userError?.message || 'Admin user not found for funding' };
  }

  const previousBalance = parseFloat(user.account_balance) || 0;
  const creditedAmount = parseFloat(completedTransaction.amount) || 0;
  const newBalance = previousBalance + creditedAmount;

  const { error: balanceError } = await supabase
    .from('users')
    .update({ account_balance: newBalance, updated_at: nowIso() })
    .eq('id', completedTransaction.user_id);

  if (balanceError) {
    await supabase
      .from('transactions')
      .update({ status: 'pending', description: 'Admin Daraja test deposit - pending', completed_at: null, updated_at: nowIso() })
      .eq('id', completedTransaction.id)
      .eq('status', 'completed');

    return { success: false, error: balanceError.message || 'Failed to update admin balance' };
  }

  try {
    await supabase.from('balance_history').insert([{
      user_id: completedTransaction.user_id,
      balance_before: previousBalance,
      balance_after: newBalance,
      change: creditedAmount,
      reason: `Admin Daraja test deposit ${completedTransaction.external_reference}`,
      created_by: completedTransaction.phone_number || phoneNumber || 'admin-daraja-test',
      created_at: nowIso(),
    }]);
  } catch (_) {}

  try {
    const { data: existingTransfer } = await supabase
      .from('fund_transfers')
      .select('id')
      .eq('checkout_request_id', checkoutRequestId)
      .maybeSingle();

    if (existingTransfer) {
      await supabase
        .from('fund_transfers')
        .update({
          status: 'completed',
          mpesa_receipt: mpesaReceipt || null,
          result_code: resultCode ?? null,
          result_description: resultDesc || null,
          completed_at: nowIso(),
          updated_at: nowIso(),
        })
        .eq('id', existingTransfer.id);
    }
  } catch (_) {}

  paymentCache.storePayment(completedTransaction.external_reference, checkoutRequestId, {
    type: 'ADMIN_DARAJA_TEST',
    amount: creditedAmount,
    phone_number: completedTransaction.phone_number || phoneNumber,
    external_reference: completedTransaction.external_reference,
    admin_user_id: completedTransaction.user_id,
    mpesaReceipt: mpesaReceipt || null,
    status: 'Success',
  });

  return {
    success: true,
    alreadyProcessed: false,
    creditedAmount,
    previousBalance,
    newBalance,
    externalReference: completedTransaction.external_reference,
    userId: completedTransaction.user_id,
  };
}

module.exports = {
  registerAdminDarajaTestAttempt,
  ensureAdminDarajaTestFunding,
};