/*
MANUAL SQL CLEANUP for test deposits
Run this directly in Supabase SQL Editor for best results.
Replace the transaction IDs with your actual test transaction IDs.
*/

-- Step 1: View test transactions to verify
SELECT id, external_reference, amount, mpesa_receipt, user_id, created_at
FROM transactions
WHERE external_reference LIKE '%ADMINTEST%'
   OR external_reference LIKE '%TEST%'
   OR mpesa_receipt IN ('SLF12345MJQ', 'QRR0TZ8JPF', 'ACT0000001');

-- Step 2: Delete test transactions (if above looks correct, run this)
DELETE FROM transactions
WHERE external_reference LIKE '%ADMINTEST%'
   OR external_reference LIKE '%TEST%'
   OR mpesa_receipt IN ('SLF12345MJQ', 'QRR0TZ8JPF', 'ACT0000001');

-- Step 3: Restore user balances - UPDATE based on your specific situation
-- Get current users with potentially incorrect balances
SELECT u.id, u.username, u.account_balance,
       COALESCE(SUM(t.amount), 0) as total_real_deposits
FROM users u
LEFT JOIN transactions t ON u.id = t.user_id 
  AND t.type = 'deposit' 
  AND t.status = 'completed'
  AND t.external_reference NOT LIKE '%ADMINTEST%'
  AND t.external_reference NOT LIKE '%TEST%'
  AND t.mpesa_receipt NOT IN ('SLF12345MJQ', 'QRR0TZ8JPF', 'ACT0000001')
GROUP BY u.id, u.username, u.account_balance;

-- Step 4: Update balances manually for affected users
-- Nelmkm: should be 10512 (remove KSH 16 from test)
UPDATE users SET account_balance = 10512 WHERE username = 'Nelmkm';

-- Paul: should be 0 (remove KSH 1234 from test)  
UPDATE users SET account_balance = 0 WHERE username = 'Paul';

-- Buie: should be 1234 (remove KSH 2000 from test)
UPDATE users SET account_balance = 1234 WHERE username = 'Buie';

-- Step 5: Verify cleanup
SELECT * FROM transactions
WHERE external_reference LIKE '%ADMINTEST%'
   OR external_reference LIKE '%TEST%'
   OR mpesa_receipt IN ('SLF12345MJQ', 'QRR0TZ8JPF', 'ACT0000001');

-- If this query returns 0 rows, cleanup is complete!
