/**
 * Callback Routes
 * Handles PayHero payment callbacks
 */

const express = require('express');
const router = express.Router();
const supabase = require('../services/database.js');
const paymentCache = require('../services/paymentCache.js');

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

    // Step 1: Get payment record by checkout_request_id (try DB first, then cache)
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
      console.log('✅ Payment found in database');
    } else {
      console.warn('⚠️ Payment not found in database, checking cache:', fetchError?.message);
      // Try cache as fallback (checks by checkoutRequestId)
      paymentData = paymentCache.getPayment(checkoutRequestId);
      if (paymentData) {
        isFromCache = true;
        console.log('✅ Payment found in cache');
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
        .eq('checkout_request_id', checkoutRequestId);

      if (updateError) {
        console.warn('⚠️ Failed to update payment in database:', updateError.message);
        // Continue anyway - cache is already updated
      } else {
        console.log('✅ Payment status updated in database');
      }
    } else {
      console.log('✅ Payment status noted (tracking in cache)');
    }

    // Step 3: If payment successful, update transaction with receipt but keep PENDING for admin approval
    // Balance is NOT credited here — admin must approve (mark-completed) which handles balance.
    if (status === 'Success' && (resultCode === 0 || resultCode === '0')) {
      console.log('\n💰 Payment successful! Keeping deposit pending for admin approval...');
      
      // Step 4: Update transaction with M-Pesa receipt but keep pending
      console.log('\n📊 Updating transaction with payment details (stays pending for admin)...');
      if (!isFromCache) {
        try {
          const { data: existingTx } = await supabase
            .from('transactions')
            .select('id')
            .eq('external_reference', external_reference)
            .eq('status', 'pending')
            .single();

          if (existingTx) {
            // Add M-Pesa receipt but keep status pending
            const { error: updateError } = await supabase
              .from('transactions')
              .update({
                mpesa_receipt: mpesaReceipt,
                description: 'M-Pesa payment received - awaiting admin approval',
                updated_at: new Date().toISOString()
              })
              .eq('id', existingTx.id);

            if (updateError) {
              console.warn('⚠️ Failed to update pending transaction:', updateError.message);
            } else {
              console.log('✅ Transaction updated with M-Pesa receipt (stays pending for admin)');
            }

            // Update fund_transfers with receipt info but keep pending
            try {
              await supabase
                .from('fund_transfers')
                .update({
                  mpesa_receipt: mpesaReceipt,
                  result_code: resultCode,
                  result_description: resultDesc,
                  updated_at: new Date().toISOString()
                })
                .eq('transaction_id', existingTx.id);
            } catch (fundError) {
              console.warn('⚠️ Error updating fund transfer:', fundError.message);
            }
          } else {
            // No existing pending transaction, create a new pending one
            const { error: transactionError } = await supabase
              .from('transactions')
              .insert({
                transaction_id: `DEP-${Date.now()}-${external_reference}`,
                user_id,
                type: 'deposit',
                amount: parseFloat(amount),
                status: 'pending',
                mpesa_receipt: mpesaReceipt,
                external_reference: external_reference,
                description: 'M-Pesa payment received - awaiting admin approval',
                created_at: new Date().toISOString()
              });

            if (transactionError) {
              console.warn('⚠️ Failed to record transaction:', transactionError.message);
            } else {
              console.log('✅ Pending deposit transaction created (awaiting admin approval)');
            }
          }
        } catch (dbError) {
          console.warn('⚠️ Database error recording transaction:', dbError.message);
        }
      } else {
        console.log('✅ Transaction noted (database unavailable, will sync when DB available)');
      }

      // Also update deposits or activation_fees table with receipt
      try {
        const { data: depositRow } = await supabase
          .from('deposits')
          .select('id')
          .eq('external_reference', external_reference)
          .single();

        if (depositRow) {
          await supabase.from('deposits').update({
            mpesa_receipt: mpesaReceipt,
            description: 'M-Pesa payment received - awaiting admin approval',
            updated_at: new Date().toISOString()
          }).eq('id', depositRow.id);
          console.log('✅ deposits table updated with M-Pesa receipt');
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
    } else if (status === 'Cancelled' || status === 'Failed' || resultCode !== 0) {
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

module.exports = router;
