$deployments = @(
    'https://betnexa-ctplj4tzv-nel-developers.vercel.app',
    'https://betnexa-rmfn1joym-nel-developers.vercel.app',
    'https://betnexa-kq6qqvqo0-nel-developers.vercel.app',
    'https://betnexa-m7uxaha1c-nel-developers.vercel.app',
    'https://betnexa-um34r914o-nel-developers.vercel.app',
    'https://betnexa-qy0he3gbr-nel-developers.vercel.app',
    'https://betnexa-6gu6wcyl2-nel-developers.vercel.app',
    'https://betnexa-ld7wc3kct-nel-developers.vercel.app',
    'https://betnexa-rex1bd4qg-nel-developers.vercel.app',
    'https://betnexa-8s52fkcj5-nel-developers.vercel.app',
    'https://betnexa-84v4a5kyx-nel-developers.vercel.app',
    'https://betnexa-5kc1ego59-nel-developers.vercel.app',
    'https://betnexa-ey1t2q6p8-nel-developers.vercel.app',
    'https://betnexa-r2kej1c0w-nel-developers.vercel.app',
    'https://betnexa-j4ts5k0uu-nel-developers.vercel.app',
    'https://betnexa-on008dxwp-nel-developers.vercel.app',
    'https://betnexa-oj64glcwo-nel-developers.vercel.app'
)

$success = 0
$failed = 0
$results = @()

foreach ($url in $deployments) {
    Write-Host "Processing: $url"
    $output = echo 'y' | vercel remove $url --safe=false 2>&1
    if ($LASTEXITCODE -eq 0) {
        $success++
        $results += " DELETED: $url"
    } else {
        $failed++
        $results += " FAILED: $url - $($output | Select-String -Pattern 'Could not find|error' | Select-Object -First 1)"
    }
}

Write-Host "
=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "Total Processed: $($deployments.Count)"
Write-Host "Successful Deletions: $success" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red
Write-Host "
=== DETAILED RESULTS ===" -ForegroundColor Cyan
$results | ForEach-Object { Write-Host $_ }
