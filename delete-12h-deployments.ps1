$deployments = @(
    'https://betnexa-9gpqeev0i-nel-developers.vercel.app',
    'https://betnexa-6kixgfut5-nel-developers.vercel.app',
    'https://betnexa-mt6zo9ppa-nel-developers.vercel.app',
    'https://betnexa-oay6shrcq-nel-developers.vercel.app',
    'https://betnexa-rmfn1joym-nel-developers.vercel.app'
)

Write-Host "Deleting frontend deployments from last 12 hours..." -ForegroundColor Cyan
Write-Host "Total: $($deployments.Count) deployments to remove`n"

$success = 0
$failed = 0

foreach ($url in $deployments) {
    Write-Host "Removing: $url" -ForegroundColor Yellow
    $output = echo 'y' | vercel remove $url --safe=false 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  SUCCESS: DELETED" -ForegroundColor Green
        $success++
    } else {
        Write-Host "  FAILED" -ForegroundColor Red
        $failed++
    }
}

Write-Host "`n=== CLEANUP SUMMARY ===" -ForegroundColor Cyan
Write-Host "Successfully deleted: $success" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red
Write-Host "Games and database: PRESERVED" -ForegroundColor Green
