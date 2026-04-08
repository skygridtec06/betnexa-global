# Daraja Paybill Migration - Testing Guide

## ✅ Changes Completed

### 1. **Credentials Updated**
- **Consumer Key**: IZVSC3FNNyAE0yrSgOGR7WcKHDw9Gb6v4A7TSzd5hUIYIYeh
- **Consumer Secret**: wtpDmTTTWorWufcT4DjOxM5owxObInFaBDMuinfosgIE1MOHqXa8AWBq7XV8QYz
- **Passkey**: 111395f54f1d024f27aae4b9312f6badd3774738f3ef76d7d35df32fe04575a6
- **Short Code**: 4046271
- **Party B**: 4046271
- **Transaction Type**: CustomerPayBillOnline

### 2. **Code Changes**
- ✅ Updated `darajaTestService.js` with new credentials as fallback
- ✅ Updated `payment.routes.js` to fetch username and use `BETNEXA {username}` format
- ✅ Updated `admin.routes.js` to use `BETNEXA admin` format for admin tests
- ✅ All environment variables deployed to Vercel production
- ✅ Committed & pushed to GitHub (commit: 112d08f)
- ✅ Deployed to Vercel production

## 🧪 Testing Plan

### Phase 1: Verify Environment Variables
```bash
# Check Vercel environment variables
vercel env ls

# Confirm new values are deployed by running:
# curl https://betnexa.co.ke/api/health
# or check the admin panel
```

### Phase 2: Test STK Push Flow

#### Test Case 1: User Deposit (Regular User)
1. Navigate to Finance → Deposit tab
2. Enter M-Pesa phone number and amount (min KSH 500)
3. Click "Deposit Now"
4. **Expected**: STK push received with account name `BETNEXA {username}`
5. **Verify**: 
   - Account reference shows in M-Pesa: `BETNEXA john_doe` (or user's account name)
   - After paying, balance updates within 1-2 minutes
   - Admin receives SMS notification of deposit completion

#### Test Case 2: Withdrawal Activation Fee
1. Navigate to Finance → Withdrawal tab
2. Enter amount and click "Withdraw Now"  
3. Should prompt for activation if not activated
4. Click "Activate Account"
5. **Expected**: STK push for KSH 1000 with account name `BETNEXA {username}`
6. **Verify**: 
   - Account reference shows correctly
   - After payment, withdrawal is activated
   - Account balance increased by KSH 1000

#### Test Case 3: Priority Withdrawal Fee
1. Go to pending withdrawal
2. Click "Prioritize" button
3. **Expected**: STK push for KSH 399 with account name `BETNEXA {username}`
4. **Verify**: 
   - Account reference format is correct
   - Balance deducted after payment
   - Withdrawal gets prioritized

#### Test Case 4: Admin Test Deposit
1. Navigate to Admin Panel → Transactions → Test Deposit
2. Enter phone number and amount
3. Click "Send STK Push"
4. **Expected**: STK push received with account name `BETNEXA admin`
5. **Verify**: 
   - Account reference shows as `BETNEXA admin`
   - Payment processes correctly
   - Admin balance updates

### Phase 3: Verify Callbacks & Notifications

#### Callback Verification
1. After successful STK payment, verify in database:
   ```sql
   SELECT * FROM payments WHERE external_reference LIKE 'DUSER%' ORDER BY created_at DESC LIMIT 5;
   SELECT * FROM transactions WHERE user_id = '{userId}' ORDER BY created_at DESC LIMIT 5;
   ```

2. Check that:
   - Payment status is `COMPLETED`
   - Transaction status is `completed`
   - User balance is updated correctly
   - `method` field shows 'M-Pesa STK Push'

#### SMS Notification Verification
1. After deposit completes, admin phone receives SMS:
   - Format: `Deposit completed: KSH {amount} from {username/phone}`
   - Timing: Within 1-2 minutes of successful STK payment

2. User receives confirmation SMS (if implemented):
   - Status confirmation
   - New balance

### Phase 4: Troubleshooting

#### Issue: STK Not Received
- Check network connectivity
- Verify phone number format (254XXXXXXXXX)
- Confirm M-Pesa account has enough balance
- Check Vercel logs for errors

#### Issue: Account Reference Incorrect
- Verify username is fetching from database
- Check user account_name field in database
- Review Daraja payload in server logs

#### Issue: Balance Not Updating
- Check callback URL is reachable
- Verify database connection
- Check `userDarajaFundingService.js` for errors
- Review payment cache for callback data

#### Issue: SMS Not Sent
- Verify TextSMS credentials on Vercel
- Check admin phone number in database
- Review TextSMS service logs

## 📊 Monitoring

### Key Endpoints to Monitor
```
POST /api/payments/daraja/initiate        - Initiate STK push
GET  /api/payments/daraja/status          - Check payment status
POST /api/callbacks/daraja-user           - Receive payment callback
POST /api/callbacks/daraja-admin-test     - Receive admin test callback
POST /api/admin/daraja-test/deposit       - Admin test STK push
GET  /api/admin/daraja-test/status        - Admin test status
```

### Logs to Monitor
- Vercel deployment logs
- Server application logs (darajaTestService)
- Database error logs
- SMS service logs (TextSMS)

## ✅ Verification Checklist

- [ ] Environment variables updated on Vercel
- [ ] Code deployed to Vercel production
- [ ] User deposit: STK shows correct account reference
- [ ] Activation FEE: STK shows correct account reference
- [ ] Priority Fee: STK shows correct account reference
- [ ] Admin test: STK shows correct account reference
- [ ] Payment callback received and processed
- [ ] User balance updated after successful payment
- [ ] Admin SMS notification sent
- [ ] Transaction recorded in database with correct status
- [ ] User can continue with withdrawal after activation

## Notes
- All payments now go to Paybill 4046271
- Account reference format: `BETNEXA {username}` or `BETNEXA admin`
- Transaction type: CustomerPayBillOnline
- Callbacks should arrive within 30 seconds of payment completion
