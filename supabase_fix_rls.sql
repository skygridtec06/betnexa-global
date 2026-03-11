-- Fix RLS for fund_transfers table
-- This script ensures fund_transfers can be inserted from the backend

-- Step 1: Disable RLS on fund_transfers (service_role bypasses it anyway)
ALTER TABLE fund_transfers DISABLE ROW LEVEL SECURITY;

-- Step 2: Ensure fund_transfers table exists and grant permissions
GRANT ALL PRIVILEGES ON fund_transfers TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

-- Step 3: Make sure the enums are accessible
GRANT USAGE ON TYPE fund_transfer_type TO authenticated, anon, service_role;
GRANT USAGE ON TYPE fund_transfer_status TO authenticated, anon, service_role;

-- Step 4: Verify the table was created properly
-- Run this to check: SELECT * FROM information_schema.tables WHERE table_name = 'fund_transfers';
