# Deposit Transaction Tracking - Complete Setup Guide

## Overview
All STK push deposits are now stored in the Supabase database as **pending transactions** the moment the user initiates the payment. Admins can view, filter, and approve these deposits through the admin panel.

## Database Setup

### 1. Run the Migration (Required for Existing Supabase)
To enable full transaction tracking in your existing Supabase database, run this SQL migration:

```sql
-- Update transactions table to support full deposit tracking
-- This migration adds missing columns and ensures transactions properly
-- store all deposit data for admin visibility

-- Add missing columns to transactions table if they don't exist
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS checkout_request_id TEXT,
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'M-Pesa STK Push',
ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Update the phone_number column to allow NULL (it comes later from callback)
ALTER TABLE transactions
ALTER COLUMN phone_number DROP NOT NULL;

-- Create index for efficient admin transaction queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_external_reference ON transactions(external_reference);
CREATE INDEX IF NOT EXISTS idx_transactions_checkout_request_id ON transactions(checkout_request_id);

-- Create composite index for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_status_date ON transactions(user_id, status, created_at DESC);

-- Enable realtime for transactions table so admin sees updates live
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
```

**Steps to run:**
1. Go to your Supabase dashboard: https://app.supabase.com
2. Navigate to your project → SQL Editor
3. Create a new query and paste the migration SQL above
4. Click "Run" to execute

### 2. Database Schema

The `transactions` table now has these key columns:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `user_id` | UUID | User who initiated the transaction |
| `type` | ENUM | 'deposit', 'withdrawal', 'bet_placement', etc. |
| `amount` | DECIMAL | Transaction amount in KSH |
| `status` | ENUM | 'pending' → 'completed' or 'failed' |
| `method` | TEXT | 'M-Pesa STK Push' |
| `external_reference` | TEXT | Payment reference for tracking |
| `checkout_request_id` | TEXT | PayHero checkout request ID |
| `mpesa_receipt` | TEXT | M-Pesa receipt number (added on callback) |
| `admin_notes` | TEXT | Admin's notes when approving |
| `completed_by` | UUID | ID of admin who approved the deposit |
| `created_at` | TIMESTAMP | When STK was sent |
| `completed_at` | TIMESTAMP | When admin marked as completed |
| `updated_at` | TIMESTAMP | Last update timestamp |

## Deposit Flow

```
1. User clicks "Activate Withdrawal" or makes a deposit
   ↓
2. Frontend calls POST /api/payments/initiate
   ↓
3. Backend sends STK push to PayHero
   ↓
4. Backend creates PENDING transaction record in database immediately
   ↓
5. Admin sees pending deposit in admin panel
   ├─ Two paths:
   │
   ├─ Path A: User enters M-Pesa PIN and payment succeeds
   │  ↓
   │  PayHero sends callback to /api/callbacks/payhero
   │  ↓
   │  Transaction auto-updated to COMPLETED
   │  ↓
   │  User balance auto-credited
   │
   └─ Path B: User doesn't complete or timeout (10 seconds)
      ↓
      Transaction stays PENDING
      ↓
      Admin manually reviews and either:
         • Marks as COMPLETED (with or without receipt)
         • Leaves pending for follow-up
```

## Admin API Endpoints

### 1. View All Transactions
```
GET /api/admin/transactions
```
Returns all transactions (deposits, withdrawals, bets, etc.)

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "type": "deposit",
      "amount": 1000,
      "status": "pending",
      "external_reference": "DEP-1234567890-user123",
      "created_at": "2026-03-09T12:00:00Z",
      "completed_at": null,
      "...": "other fields"
    }
  ]
}
```

### 2. View Pending Deposits Only (NEW)
```
GET /api/admin/transactions/pending/deposits
```
Shows all STK pushes waiting for admin confirmation - **this is the main one to use!**

**Response:**
```json
{
  "success": true,
  "pending_deposits": [
    {
      "id": "txn_uuid",
      "user": {
        "id": "user_id",
        "username": "john_doe",
        "phone_number": "254701234567",
        "account_balance": 5000
      },
      "amount": 1000,
      "status": "pending",
      "external_reference": "DEP-1234567890-user123",
      "checkout_request_id": "CHKOUT-967890",
      "method": "M-Pesa STK Push",
      "created_at": "2026-03-09T12:00:00Z"
    }
  ],
  "count": 5
}
```

### 3. Filter Transactions by Status and Type (NEW)
```
GET /api/admin/transactions/filter?status=pending&type=deposit&limit=50&offset=0
```

**Query Parameters:**
- `status` - 'pending', 'completed', 'failed', 'cancelled' (optional)
- `type` - 'deposit', 'withdrawal', 'bet_placement', etc. (optional)
- `limit` - Results per page (default: 100)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "transactions": [...],
  "count": 25
}
```

### 4. Mark Transaction as Completed (NEW)
```
PUT /api/admin/transactions/{transactionId}/mark-completed
```

**Request Body:**
```json
{
  "mpesaReceipt": "LKR12345ABC",  // Optional - M-Pesa receipt number
  "notes": "Confirmed with user via call"  // Optional - admin's notes
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transaction marked as completed",
  "transaction": {
    "id": "txn_uuid",
    "status": "completed",
    "completedAt": "2026-03-09T12:05:00Z"
  }
}
```

**What happens:**
- ✅ Transaction status changes from 'pending' to 'completed'
- ✅ M-Pesa receipt added (if provided)
- ✅ Admin notes saved
- ✅ User balance automatically credited with the deposit amount
- ✅ `completed_by` field records which admin approved it
- ✅ `completed_at` timestamp is set

### 5. Get User's Transactions
```
GET /api/admin/transactions/user/{userId}
```
See all transactions for a specific user

**Response:**
```json
{
  "success": true,
  "user": {
    "username": "john_doe",
    "phone_number": "254701234567",
    "account_balance": 12000
  },
  "transactions": [...],
  "count": 15
}
```

## Admin Workflow

### Daily Deposit Review
1. **Check pending deposits:**
   ```
   GET /api/admin/transactions/pending/deposits
   ```

2. **For each pending deposit:**
   - Verify user details (phone, name)
   - Check if M-Pesa receipt is available
   - If legitimate, mark as completed:
     ```
     PUT /api/admin/transactions/{txnId}/mark-completed
     Body: { "mpesaReceipt": "LKR12345", "notes": "Verified with user" }
     ```
   - If suspicious, contact user or leave pending

3. **Audit trail:**
   - Admin who approved is recorded in `completed_by`
   - Admin notes are saved in `admin_notes`
   - Completion timestamp in `completed_at`

## Key Features

✅ **Persistent Across Devices** - Transaction stored immediately, visible even if user closes app

✅ **Automatic on Callback** - When PayHero confirms payment, transaction auto-updates to completed

✅ **Manual Override** - Admin can manually mark as completed with notes

✅ **Audit Trail** - Track which admin approved which deposits

✅ **Real-time Updates** - Admin panel auto-updates as deposits come in (realtime enabled)

✅ **Indexed Queries** - Fast filtering by status, user, date, external reference

✅ **Balance Auto-Credit** - When marked completed, user balance is automatically increased

## Testing

### Test STK Push Storage
1. Go to user page in admin
2. Click "Activate Withdrawal"
3. Enter phone number (e.g., 0701234567)
4. Check `admin/transactions/pending/deposits` endpoint
5. Should see a new pending transaction immediately

### Test Auto-Completion
1. During test, if user enters M-Pesa PIN and payment succeeds
2. Transaction should auto-update to 'completed' within seconds
3. User balance should be credited automatically

### Test Manual Approval
1. Create a pending transaction
2. Call `PUT /api/admin/transactions/{id}/mark-completed` with M-Pesa receipt
3. Transaction should change to 'completed'
4. User balance should be credited
5. Verify `admin_notes` and `completed_by` are saved

## Troubleshooting

### Transaction shows as pending but payment succeeded
- Check callback logs on server
- PayHero callback may have failed
- Manually call mark-completed endpoint with M-Pesa receipt

### Transaction not appearing in pending list
- Ensure migration has run (check for `checkout_request_id` column)
- Check if STK was actually sent (check PayHero API logs)
- Restart admin panel or hard-refresh browser

### User balance not credited after marking complete
- Check that transaction has `type: 'deposit'`
- Ensure `amount` field is set correctly
- Admin user must have proper role permission

## Database Backup
Before running migration, backup your database:
```
1. Go to Supabase dashboard
2. Settings → Backups
3. Click "Create backup"
4. Wait for completion
5. Then run the migration
```

## Support
For issues, check:
- Supabase SQL logs: Project → Logs → SQL
- Server logs: Vercel → server project → Logs
- Browser console: Admin panel → F12
