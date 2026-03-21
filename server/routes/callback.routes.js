/**
 * Callback Routes
 * Handles PayHero payment callbacks
 */

const express = require('express');
const router = express.Router();
const supabase = require('../services/database.js');
const paymentCache = require('../services/paymentCache.js');
const { ensureAdminDarajaTestFunding } = require('../services/adminDarajaTestFundingService');
const { ensureUserDarajaFunding, persistUserDarajaTerminalStatus } = require('../services/userDarajaFundingService');
const { sendDepositSms } = require('../services/smsService.js');

/**
 * POST /api/callbacks/payhero
 * Receive payment callback from PayHero
 */
router.post('/payhero', async (req, res) => {
  try {
    let callbackData = req.body;
    
    console.log('\n🔔 PayHero Callback Received:', JSON.stringify(callbackData, null, 2));

    // Handle different callback payload structures from PayHero
    let checkoutRequestId = callbackData.CheckoutRequestID || callbackData.checkout_request_id;
    let status = callbackData.Status || callbackData.status;
    let resultCode = callbackData.ResultCode !== undefined ? callbackData.ResultCode : callbackData.result_code;
    let resultDesc = callbackData.ResultDesc || callbackData.result_desc;
    let mpesaReceipt = callbackData.MpesaReceiptNumber || callbackData.mpesa_receipt_number;

    console.log('📋 Parsed Callback Data:');
    console.log('   CheckoutRequestID:', checkoutRequestId);
    console.log('   Status:', status);
    console.log('   ResultCode:', resultCode);
    console.log('   MpesaReceipt:', mpesaReceipt);

    if (!checkoutRequestId) {
      console.warn('⚠️ Invalid callback data - missing CheckoutRequestID');
      return res.status(400).json({
        success: false,
        message: 'Invalid callback data - missing CheckoutRequestID'
      });
    }

    // Step 1: Get payment record by checkout_request_id (payments -> deposits -> cache)
    console.log('\n🔍 Looking up payment record...');
    let paymentData = null;
    let isFromCache = false;
    
    const { data: dbPaymentData, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('checkout_request_id', checkoutRequestId)
      .single();

    if (!fetchError && dbPaymentData) {
      paymentData = dbPaymentData;
      console.log('✅ Payment found in payments table');
    } else {
      // Fallback to deposits table (this table reliably stores checkout_request_id)
      const { data: depData, error: depError } = await supabase
        .from('deposits')
        .select('user_id, amount, external_reference, checkout_request_id')
        .eq('checkout_request_id', checkoutRequestId)
        .maybeSingle();

      if (!depError && depData) {
        paymentData = depData;
        console.log('✅ Payment found in deposits table');
      } else {
        console.warn('⚠️ Payment not found in DB tables, checking cache:', fetchError?.message || depError?.message);
      }

      // Try cache as fallback (checks by checkoutRequestId)
      if (!paymentData) {
        paymentData = paymentCache.getPayment(checkoutRequestId);
        if (paymentData) {
          isFromCache = true;
          console.log('✅ Payment found in cache');
        }
      }
    }

    if (!paymentData) {
      console.warn('⚠️ Payment not found in database or cache:', checkoutRequestId);
      // Still return 200 to PayHero so it doesn't retry
      return res.json({
        success: true,
        message: 'Callback processed (payment not found)'
      });
    }

    const { user_id, amount, external_reference } = paymentData;
    console.log('✅ Payment found - User:', user_id, 'Amount:', amount, isFromCache ? '(from cache)' : '(from database)');

    // Store callback data in cache for reference
    try {
      paymentCache.storeCallback(checkoutRequestId, {
        status,
        resultCode,
        resultDesc,
        mpesaReceipt,
        timestamp: new Date().toISOString()
      });
      console.log('✅ Callback data cached');
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache callback:', cacheError.message);
    }

    // Step 2: Update payment record with callback status
    console.log('\n📝 Updating payment status...');
    const updateData = {
      status: status,
      result_code: resultCode,
      result_desc: resultDesc,
      mpesa_receipt_number: mpesaReceipt,
      updated_at: new Date().toISOString()
    };

    if (!isFromCache) {
      // Try to update in database
      const { error: updateError } = await supabase
        .from('payments')
        .update(updateData)
        .eq('external_reference', external_reference);

      if (updateError) {
        console.warn('⚠️ Failed to update payment in database:', updateError.message);
        // Continue anyway - cache is already updated
      } else {
        console.log('✅ Payment status updated in database');
      }
    } else {
      console.log('✅ Payment status noted (tracking in cache)');
    }

    // Step 3: If payment successful, immediately credit user balance and mark transaction completed.
    // Case-insensitive status check — PayHero may send Success / SUCCESS / success.
    // Cancelled/Failed paths below do NOT touch balance at all.
    const normalizedStatus = (status || '').toString().trim().toLowerCase();
    const isPaymentSuccess = normalizedStatus === 'success' && (resultCode === 0 || resultCode === '0');

    if (isPaymentSuccess) {
      console.log('\n💰 Payment successful! Checking idempotency before crediting balance...');

      try {
        // --- Idempotency check: skip if balance was already credited for this reference ---
        const { data: alreadyDone } = await supabase
          .from('transactions')
          .select('id, status')
          .eq('external_reference', external_reference)
          .eq('status', 'completed')
          .maybeSingle();

        const { data: completedDeposit } = await supabase
          .from('deposits')
          .select('id, status')
          .eq('external_reference', external_reference)
          .eq('status', 'completed')
          .maybeSingle();

        if (alreadyDone || completedDeposit) {
          console.log('⚠️ Transaction already completed for this reference — skipping double credit');
        } else {
          // --- Credit user account_balance ---
          const { data: userRow, error: userFetchErr } = await supabase
            .from('users')
            .select('account_balance, phone_number')
            .eq('id', user_id)
            .single();

          if (userFetchErr || !userRow) {
            console.warn('⚠️ Could not fetch user for balance credit:', userFetchErr?.message);
          } else {
            const creditAmount = parseFloat(amount);
            const prevBalance = parseFloat(userRow.account_balance) || 0;
            const newBalance = prevBalance + creditAmount;

            const { error: balanceErr } = await supabase
              .from('users')
              .update({ account_balance: newBalance, updated_at: new Date().toISOString() })
              .eq('id', user_id);

            if (balanceErr) {
              console.warn('⚠️ Failed to credit user balance:', balanceErr.message);
            } else {
              console.log(`✅ Balance credited: KSH ${prevBalance} → KSH ${newBalance} (user ${user_id})`);
              // Send deposit confirmed SMS (fire-and-forget)
              const smsPhone = userRow.phone_number || paymentData?.phone_number;
              if (smsPhone) {
                sendDepositSms(smsPhone, creditAmount, newBalance).catch(() => {});
              }
            }
          }

          // --- Mark existing pending transaction as completed (or create one) ---
          const { data: pendingTx } = await supabase
            .from('transactions')
            .select('id')
            .eq('external_reference', external_reference)
            .eq('status', 'pending')
            .maybeSingle();

          if (pendingTx) {
            const { error: updateError } = await supabase
              .from('transactions')
              .update({
                status: 'completed',
                mpesa_receipt: mpesaReceipt,
                description: 'M-Pesa payment received and balance credited',
                updated_at: new Date().toISOString()
              })
              .eq('id', pendingTx.id);

            if (updateError) {
              console.warn('⚠️ Failed to mark transaction completed:', updateError.message);
            } else {
              console.log('✅ Transaction marked as completed');
            }
          } else {
            // No pending transaction existed — insert a completed one (balance was already credited above)
            const { error: insertErr } = await supabase
              .from('transactions')
              .insert({
                transaction_id: `DEP-${Date.now()}-${external_reference}`,
                user_id,
                type: 'deposit',
                amount: parseFloat(amount),
                status: 'completed',
                mpesa_receipt: mpesaReceipt,
                external_reference: external_reference,
                description: 'M-Pesa payment received and balance credited',
                created_at: new Date().toISOString()
              });

            if (insertErr) {
              console.warn('⚠️ Failed to record completed transaction:', insertErr.message);
            } else {
              console.log('✅ Completed deposit transaction recorded');
            }
          }

          // --- Update fund_transfers by external_reference (checkout_request_id also tried) ---
          try {
            await supabase
              .from('fund_transfers')
              .update({
                status: 'completed',
                mpesa_receipt: mpesaReceipt,
                result_code: resultCode,
                result_description: resultDesc,
                updated_at: new Date().toISOString()
              })
              .eq('external_reference', external_reference);
          } catch (fundError) {
            console.warn('⚠️ Error updating fund transfer:', fundError.message);
          }
        }
      } catch (dbError) {
        console.warn('⚠️ Database error processing successful payment:', dbError.message);
      }

      // Also update deposits or activation_fees table to mark completed
      try {
        const { data: depositRow } = await supabase
          .from('deposits')
          .select('id')
          .eq('external_reference', external_reference)
          .single();

        if (depositRow) {
          await supabase.from('deposits').update({
            status: 'completed',
            mpesa_receipt: mpesaReceipt,
            description: 'M-Pesa payment received and balance credited',
            updated_at: new Date().toISOString()
          }).eq('id', depositRow.id);
          console.log('✅ deposits table marked as completed');
        } else {
          // Check activation_fees table
          const { data: feeRow } = await supabase
            .from('activation_fees')
            .select('id')
            .eq('external_reference', external_reference)
            .single();

          if (feeRow) {
            await supabase.from('activation_fees').update({
              mpesa_receipt: mpesaReceipt,
              status: 'completed',
              updated_at: new Date().toISOString()
            }).eq('id', feeRow.id);
            console.log('✅ activation_fees table updated with M-Pesa receipt (completed)');
          }
        }
      } catch (tableErr) {
        console.warn('⚠️ Error updating deposits/activation_fees:', tableErr.message);
      }
    } else if (!isPaymentSuccess) {
      // Payment failed or was cancelled — never touch balance
      console.log('\n❌ Payment failed or cancelled. Status:', status, 'ResultCode:', resultCode);
      
      // Update or record the failed transaction
      if (!isFromCache) {
        try {
          // Try to find and update existing pending transaction first
          const { data: existingTx } = await supabase
            .from('transactions')
            .select('id')
            .eq('external_reference', external_reference)
            .eq('status', 'pending')
            .single();

          if (existingTx) {
            // Update the pending transaction to failed
            const { error: updateError } = await supabase
              .from('transactions')
              .update({
                status: status.toLowerCase(),
                mpesa_receipt: mpesaReceipt || '',
                updated_at: new Date().toISOString()
              })
              .eq('id', existingTx.id);

            if (updateError) {
              console.warn('⚠️ Failed to update pending transaction:', updateError.message);
            } else {
              console.log('✅ Pending transaction updated to failed');
            }

            // Also update fund_transfers status if it exists
            try {
              const { error: fundUpdateError } = await supabase
                .from('fund_transfers')
                .update({
                  status: 'failed',
                  failed_at: new Date().toISOString(),
                  result_code: resultCode,
                  result_description: resultDesc
                })
                .eq('transaction_id', existingTx.id);

              if (fundUpdateError) {
                console.warn('⚠️ Failed to update fund transfer status:', fundUpdateError.message);
              } else {
                console.log('✅ Fund transfer status updated to failed');
              }
            } catch (fundError) {
              console.warn('⚠️ Error updating fund transfer:', fundError.message);
            }
          } else {
            // No existing pending transaction, create a new failed one
            await supabase
              .from('transactions')
              .insert({
                transaction_id: `FAIL-${Date.now()}-${external_reference}`,
                user_id,
                type: 'deposit',
                amount: parseFloat(amount),
                status: status.toLowerCase(),
                mpesa_receipt: mpesaReceipt || '',
                external_reference: external_reference,
                created_at: new Date().toISOString()
              });
            console.log('✅ Failed transaction recorded');
          }
        } catch (err) {
          console.warn('⚠️ Failed to record failed transaction:', err.message);
        }
      } else {
        console.log('✅ Failure recorded (database unavailable)');
      }

      // Also update deposits or activation_fees table to failed
      try {
        const { data: depositRow } = await supabase
          .from('deposits')
          .select('id')
          .eq('external_reference', external_reference)
          .single();

        if (depositRow) {
          await supabase.from('deposits').update({
            status: 'failed',
            updated_at: new Date().toISOString()
          }).eq('id', depositRow.id);
          console.log('✅ deposits table marked as failed');
        } else {
          const { data: feeRow } = await supabase
            .from('activation_fees')
            .select('id')
            .eq('external_reference', external_reference)
            .single();

          if (feeRow) {
            await supabase.from('activation_fees').update({
              status: 'failed',
              updated_at: new Date().toISOString()
            }).eq('id', feeRow.id);
            console.log('✅ activation_fees table marked as failed');
          }
        }
      } catch (tableErr) {
        console.warn('⚠️ Error updating deposits/activation_fees to failed:', tableErr.message);
      }
    }

    console.log('\n✅ Callback processing completed successfully\n');

    // Return success to PayHero
    res.json({
      success: true,
      message: 'Callback received and processed successfully'
    });

  } catch (error) {
    console.error('❌ Callback processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Callback processing failed',
      error: error.message
    });
  }
});

router.post('/daraja-admin-test', async (req, res) => {
  try {
    const stkCallback = req.body?.Body?.stkCallback || req.body?.stkCallback || req.body;
    const checkoutRequestId = stkCallback?.CheckoutRequestID;
    const merchantRequestId = stkCallback?.MerchantRequestID;
    const resultCode = stkCallback?.ResultCode;
    const resultDesc = stkCallback?.ResultDesc;
    const metadataItems = Array.isArray(stkCallback?.CallbackMetadata?.Item)
      ? stkCallback.CallbackMetadata.Item
      : [];

    const metadata = metadataItems.reduce((acc, item) => {
      if (item?.Name) {
        acc[item.Name] = item.Value;
      }
      return acc;
    }, {});

    console.log('\n🔔 Daraja Admin Test Callback Received:', JSON.stringify(req.body, null, 2));

    if (checkoutRequestId) {
      const isCancelled = `${resultCode}` === '1032' || /cancel|insufficient\s*funds|balance\s+is\s+insufficient/i.test(`${resultDesc || ''}`);
      const normalizedStatus = `${resultCode}` === '0'
        ? 'Success'
        : (isCancelled ? 'Cancelled' : 'Failed');

      paymentCache.storeCallback(checkoutRequestId, {
        status: normalizedStatus,
        resultCode,
        resultDesc,
        merchantRequestId,
        mpesaReceipt: metadata.MpesaReceiptNumber || null,
        amount: metadata.Amount || null,
        phoneNumber: metadata.PhoneNumber || null,
        transactionDate: metadata.TransactionDate || null,
      });

      if (normalizedStatus === 'Success') {
        const fundingResult = await ensureAdminDarajaTestFunding({
          checkoutRequestId,
          mpesaReceipt: metadata.MpesaReceiptNumber || null,
          resultCode,
          resultDesc,
          amount: metadata.Amount || null,
          phoneNumber: metadata.PhoneNumber || null,
        });

        if (!fundingResult.success) {
          console.error('Admin Daraja test funding error:', fundingResult.error || 'Unknown funding error');
        }
      }
    }

    res.json({ ResponseCode: '00000000', ResponseDesc: 'Accepted' });
  } catch (error) {
    console.error('Daraja admin test callback error:', error.message || error);
    res.status(200).json({ ResponseCode: '00000000', ResponseDesc: 'Accepted with error' });
  }
});

/**
 * POST /api/callbacks/daraja-user
 * Receive Daraja callbacks for user deposits, activation fees, and priority fees.
 */
router.post('/daraja-user', async (req, res) => {
  try {
    const stkCallback = req.body?.Body?.stkCallback || req.body?.stkCallback || req.body;
    const checkoutRequestId = stkCallback?.CheckoutRequestID;
    const merchantRequestId = stkCallback?.MerchantRequestID;
    const resultCode = stkCallback?.ResultCode;
    const resultDesc = stkCallback?.ResultDesc;
    const metadataItems = Array.isArray(stkCallback?.CallbackMetadata?.Item)
      ? stkCallback.CallbackMetadata.Item
      : [];

    const metadata = metadataItems.reduce((acc, item) => {
      if (item?.Name) acc[item.Name] = item.Value;
      return acc;
    }, {});

    console.log('\n\uD83D\uDD14 Daraja User Callback Received:', JSON.stringify(req.body, null, 2));

    if (checkoutRequestId) {
      const isCancelled = `${resultCode}` === '1032'
        || /cancel|insufficient\s*funds|balance\s+is\s+insufficient/i.test(`${resultDesc || ''}`);
      const normalizedStatus = `${resultCode}` === '0'
        ? 'Success'
        : (isCancelled ? 'Cancelled' : 'Failed');

      paymentCache.storeCallback(checkoutRequestId, {
        status: normalizedStatus,
        resultCode,
        resultDesc,
        merchantRequestId,
        mpesaReceipt: metadata.MpesaReceiptNumber || null,
        amount: metadata.Amount || null,
        phoneNumber: metadata.PhoneNumber || null,
        transactionDate: metadata.TransactionDate || null,
      });

      if (normalizedStatus === 'Success') {
        const fundingResult = await ensureUserDarajaFunding({
          checkoutRequestId,
          mpesaReceipt: metadata.MpesaReceiptNumber || null,
          resultCode,
          resultDesc,
          amount: metadata.Amount || null,
          phoneNumber: metadata.PhoneNumber || null,
        });

        if (!fundingResult.success) {
          console.error('User Daraja funding error in callback:', fundingResult.error || 'Unknown error');
        } else {
          console.log(`\u2705 User Daraja callback: Credited KSH ${fundingResult.creditedAmount} to user ${fundingResult.userId}. New balance: ${fundingResult.newBalance}`);
        }
      } else {
        const terminalStatus = normalizedStatus === 'Cancelled' ? 'cancelled' : 'failed';
        const terminalResult = await persistUserDarajaTerminalStatus({
          checkoutRequestId,
          status: terminalStatus,
          resultCode,
          resultDesc,
          mpesaReceipt: metadata.MpesaReceiptNumber || null,
          amount: metadata.Amount || null,
          phoneNumber: metadata.PhoneNumber || null,
        });

        if (!terminalResult.success) {
          console.error('User Daraja terminal status persist error:', terminalResult.error || 'Unknown error');
        } else {
          console.log(`✅ User Daraja callback: Marked transaction as ${terminalStatus} for checkout ${checkoutRequestId}`);
        }
      }
    }

    res.json({ ResponseCode: '00000000', ResponseDesc: 'Accepted' });
  } catch (error) {
    console.error('Daraja user callback error:', error.message || error);
    res.status(200).json({ ResponseCode: '00000000', ResponseDesc: 'Accepted with error' });
  }
});

module.exports = router;
