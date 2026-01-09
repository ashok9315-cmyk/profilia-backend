#!/usr/bin/env pwsh
# Cleanup script for Profilia Backend

Write-Host "🗑️  Profilia Cleanup Script" -ForegroundColor Red
Write-Host "================================`n" -ForegroundColor Red

Write-Host "⚠️  WARNING: This will DELETE all resources:" -ForegroundColor Yellow
Write-Host "   - Lambda Function" -ForegroundColor White
Write-Host "   - DynamoDB Table (all job data)" -ForegroundColor White
Write-Host "   - S3 Buckets (all portfolios and website)" -ForegroundColor White
Write-Host "   - CloudFront Distribution" -ForegroundColor White

$confirm = Read-Host "`nAre you sure? This cannot be undone! (type 'DELETE' to confirm)"
if ($confirm -ne "DELETE") {
    Write-Host "❌ Cleanup cancelled" -ForegroundColor Green
    exit 0
}

Write-Host "`n🗑️  Destroying all resources..." -ForegroundColor Red
Set-Location (Join-Path $PSScriptRoot ".")
cdk destroy --all --force

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ All resources have been deleted" -ForegroundColor Green
} else {
    Write-Host "`n❌ Cleanup failed!" -ForegroundColor Red
    Write-Host "You may need to manually delete some resources in AWS Console" -ForegroundColor Yellow
    exit 1
}
