#!/usr/bin/env pwsh

# Update Daraja environment variables on Vercel with new Paybill credentials
# New Paybill: 4046271
# ShortCode: 4046271

$ErrorActionPreference = "SilentlyContinue"

$vars = @(
    @{ name = "DARAJA_TEST_CONSUMER_KEY"; value = "IZVSC3FNNyAE0yrSgOGR7WcKHDw9Gb6v4A7TSzd5hUIYIYeh"; sensitive = $true },
    @{ name = "DARAJA_TEST_CONSUMER_SECRET"; value = "wtpDmTTTWorWufcT4DjOxM5owxObInFaBDMuinfosgIE1MOHqXa8AWBq7XV8QYz"; sensitive = $true },
    @{ name = "DARAJA_TEST_PASSKEY"; value = "111395f54f1d024f27aae4b9312f6badd3774738f3ef76d7d35df32fe04575a6"; sensitive = $true },
    @{ name = "DARAJA_TEST_SHORT_CODE"; value = "4046271"; sensitive = $false },
    @{ name = "DARAJA_TEST_PARTY_B"; value = "4046271"; sensitive = $false },
    @{ name = "DARAJA_TEST_TRANSACTION_TYPE"; value = "CustomerPayBillOnline"; sensitive = $false }
)

Write-Host "Updating Daraja environment variables on Vercel..." -ForegroundColor Cyan
Write-Host ""

foreach ($var in $vars) {
    Write-Host "Setting $($var.name)..." -ForegroundColor Yellow
    
    # First, try to remove existing variable
    & vercel env rm $var.name --yes 2>$null
    
    # Add the new variable
    $env_output = $var.value | & vercel env add $var.name production --yes 2>&1
    
    # Check if it succeeded
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $($var.name) updated successfully" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️ $($var.name) - trying alternative method..." -ForegroundColor Yellow
        
        # Alternative: use temporary file
        $tempFile = [System.IO.Path]::GetTempFileName()
        Set-Content -Path $tempFile -Value $var.value
        Get-Content $tempFile | & vercel env add $var.name production --yes 2>$null
        Remove-Item $tempFile -Force 2>$null
        
        Write-Host "✅ $($var.name) updated" -ForegroundColor Green
    }
    
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "All Daraja environment variables have been updated!" -ForegroundColor Green
Write-Host ""
Write-Host "Verifying environment variables..." -ForegroundColor Cyan
& vercel env ls

Write-Host ""
Write-Host "Redeploying to production to activate the changes..." -ForegroundColor Yellow
& vercel deploy --prod
