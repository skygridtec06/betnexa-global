# Vercel Environment Setup Script (PowerShell)
# This script configures Vercel environment variables for both frontend and backend

Write-Host "🔗 BETNEXA Vercel Deployment Configuration" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

Write-Host "✓ Frontend URL: https://betnexa.vercel.app" -ForegroundColor Cyan
Write-Host "✓ Backend URL: https://betnexa-globalback.vercel.app" -ForegroundColor Cyan
Write-Host ""

Write-Host "STEP 1: Link Frontend Project" -ForegroundColor Yellow
Write-Host "----------------------------" -ForegroundColor Yellow
Write-Host "Command: npx vercel link --project betnexa" -ForegroundColor White
Write-Host ""

Write-Host "STEP 2: Link Backend Project" -ForegroundColor Yellow
Write-Host "---------------------------" -ForegroundColor Yellow
Write-Host "Commands:" -ForegroundColor White
Write-Host "  cd server" -ForegroundColor White
Write-Host "  npx vercel link --project server-tau-puce" -ForegroundColor White
Write-Host ""

Write-Host "STEP 3: Pull Environment Variables" -ForegroundColor Yellow
Write-Host "---------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "For Frontend:" -ForegroundColor White
Write-Host "  npx vercel env pull .env.local" -ForegroundColor White
Write-Host ""
Write-Host "For Backend:" -ForegroundColor White
Write-Host "  cd server" -ForegroundColor White
Write-Host "  npx vercel env pull .env" -ForegroundColor White
Write-Host ""

Write-Host "STEP 4: Set Environment Variables on Vercel Dashboard" -ForegroundColor Yellow
Write-Host "-----------------------------------------------------" -ForegroundColor Yellow
Write-Host ""

Write-Host "🌐 FRONTEND SETTINGS" -ForegroundColor Cyan
Write-Host "URL: https://vercel.com/dashboard/betnexa/settings/environment-variables" -ForegroundColor White
Write-Host ""
Write-Host "Add these variables:" -ForegroundColor White
Write-Host "  VITE_SUPABASE_URL" -ForegroundColor Gray
Write-Host "    Value: https://eaqogmybihiqzivuwyav.supabase.co" -ForegroundColor White
Write-Host ""
Write-Host "  VITE_SUPABASE_ANON_KEY" -ForegroundColor Gray
Write-Host "    Value: sb_publishable_Lc8dQIzND4_qyIbN2EuQrQ_0Ma0OINQ" -ForegroundColor White
Write-Host ""
Write-Host "  VITE_API_URL" -ForegroundColor Gray
Write-Host "    Value: https://server-tau-puce.vercel.app" -ForegroundColor White
Write-Host ""

Write-Host "📱 BACKEND SETTINGS" -ForegroundColor Cyan
Write-Host "URL: https://vercel.com/dashboard/server-chi-orcin/settings/environment-variables" -ForegroundColor White
Write-Host ""
Write-Host "Add these variables:" -ForegroundColor White
Write-Host "  SUPABASE_URL" -ForegroundColor Gray
Write-Host "    Value: https://eaqogmybihiqzivuwyav.supabase.co" -ForegroundColor White
Write-Host ""
Write-Host "  SUPABASE_SERVICE_KEY" -ForegroundColor Gray
Write-Host "    Value: <your-supabase-service-key>" -ForegroundColor White
Write-Host ""
Write-Host "  SUPABASE_ANON_KEY" -ForegroundColor Gray
Write-Host "    Value: <your-supabase-anon-key>" -ForegroundColor White
Write-Host ""
Write-Host "  PAYHERO_API_KEY" -ForegroundColor Gray
Write-Host "    Value: 6CUxNcfi9jRpr4eWicAn" -ForegroundColor White
Write-Host ""
Write-Host "  PAYHERO_API_SECRET" -ForegroundColor Gray
Write-Host "    Value: j6zP2XpAlXn9UhtHOj9PbYQVAdlQnkeyrEWuFOAH" -ForegroundColor White
Write-Host ""
Write-Host "  PAYHERO_ACCOUNT_ID" -ForegroundColor Gray
Write-Host "    Value: 3398" -ForegroundColor White
Write-Host ""
Write-Host "  NODE_ENV" -ForegroundColor Gray
Write-Host "    Value: production" -ForegroundColor White
Write-Host ""

Write-Host "STEP 5: Redeploy Both Projects" -ForegroundColor Yellow
Write-Host "-----------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "After adding environment variables, redeploy:" -ForegroundColor White
Write-Host "1. Open Frontend project: https://vercel.com/dashboard/betnexa/deployments" -ForegroundColor White
Write-Host "   → Click latest deployment → Redeploy" -ForegroundColor White
Write-Host ""
Write-Host "2. Go to Backend project: https://vercel.com/dashboard/server-tau-puce/deployments" -ForegroundColor White
Write-Host "   → Click latest deployment → Redeploy" -ForegroundColor White
Write-Host ""

Write-Host "✅ Testing Your Deployment" -ForegroundColor Green
Write-Host "------------------------" -ForegroundColor Green
Write-Host "Frontend: https://betnexa.vercel.app" -ForegroundColor Cyan
Write-Host "Backend Health: https://betnexa-globalback.vercel.app/api/health" -ForegroundColor Cyan
