@echo off
REM Quick setup for Vercel environment variables
REM This script adds the required environment variables to the frontend project

cd /d "c:\Users\user\Downloads\BETNEXA PROFESSIONAL"

echo Adding Frontend Environment Variables to Vercel...
echo ===================================================
echo.

echo Setting VITE_SUPABASE_URL...
npx vercel env add VITE_SUPABASE_URL https://eaqogmybihiqzivuwyav.supabase.co --environment production --yes

echo Setting VITE_SUPABASE_ANON_KEY...
npx vercel env add VITE_SUPABASE_ANON_KEY sb_publishable_Lc8dQIzND4_qyIbN2EuQrQ_0Ma0OINQ --environment production --yes

echo Setting VITE_API_URL (Backend URL)...
npx vercel env add VITE_API_URL https://betnexa-globalback.vercel.app --environment production --yes

echo.
echo ✅ Frontend environment variables added!
echo.
echo Next steps:
echo 1. Redeploy frontend: visit https://vercel.com/dashboard/betnexa/deployments
echo 2. Click latest deployment -> Redeploy
echo 3. Wait for deployment to finish
echo.
pause
