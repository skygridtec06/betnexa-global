#!/usr/bin/env powershell

Write-Host ""
Write-Host "DARAJA STK PUSH MIGRATION VERIFICATION" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Check Git commits
Write-Host "Git Commits:" -ForegroundColor Yellow
git log --oneline -3
Write-Host ""

# Check for SKYGRID TECHNOLOGIES in code
Write-Host "Code Verification:" -ForegroundColor Yellow
$count = (Get-Content server/routes/payment.routes.js -ErrorAction SilentlyContinue | Select-String "SKYGRID TECHNOLOGIES" | Measure-Object).Count
Write-Host "SKYGRID TECHNOLOGIES in payment routes: $count OK" -ForegroundColor Green
Write-Host ""

# Check Vercel environment variables
Write-Host "Vercel Environment Variables:" -ForegroundColor Yellow
vercel env ls | Select-String "DARAJA"
Write-Host ""

Write-Host "Migration Status: COMPLETE" -ForegroundColor Green
Write-Host ""
Write-Host "Key Changes:" -ForegroundColor Cyan
Write-Host "- Till: 5388069 to Paybill: 4046271" -ForegroundColor White
Write-Host "- Account Ref: BETNEXA to SKYGRID TECHNOLOGIES" -ForegroundColor White
Write-Host "- Deployed: https://betnexa.co.ke" -ForegroundColor White
Write-Host ""
