#!/usr/bin/env pwsh
# Profilia Frontend Deployment Script
# Uploads frontend files to S3 and invalidates CloudFront cache

Write-Host "Profilia Frontend Deployment" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

# Get AWS account ID
Write-Host "Getting AWS account information..." -ForegroundColor Yellow
$accountId = aws sts get-caller-identity --query Account --output text

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to get AWS account ID. Please check your AWS credentials." -ForegroundColor Red
    exit 1
}

# Configuration
$websiteBucket = "profilia-website-$accountId"
$distributionId = "E1DYHLPY2DJX26"
$frontendPath = "public_html"

Write-Host "Account ID: $accountId" -ForegroundColor Green
Write-Host "S3 Bucket: $websiteBucket" -ForegroundColor Green
Write-Host "CloudFront Distribution: $distributionId" -ForegroundColor Green
Write-Host ""

# Check if frontend directory exists
if (-not (Test-Path $frontendPath)) {
    Write-Host "Frontend directory not found!" -ForegroundColor Red
    exit 1
}

# Upload to S3
Write-Host "Uploading files to S3..." -ForegroundColor Yellow
aws s3 sync $frontendPath s3://$websiteBucket/ --delete --exclude "*.md" --exclude ".git/*"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to upload files to S3" -ForegroundColor Red
    exit 1
}

Write-Host "Files uploaded successfully!" -ForegroundColor Green
Write-Host ""

# Create CloudFront invalidation
Write-Host "Invalidating CloudFront cache..." -ForegroundColor Yellow
$invalidationOutput = aws cloudfront create-invalidation --distribution-id $distributionId --paths "/*" --output json | ConvertFrom-Json

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create CloudFront invalidation" -ForegroundColor Red
    exit 1
}

$invalidationId = $invalidationOutput.Invalidation.Id
Write-Host "Invalidation created: $invalidationId" -ForegroundColor Green
Write-Host ""

# Wait for invalidation to complete
Write-Host "Waiting for invalidation to complete..." -ForegroundColor Yellow
Write-Host "(This usually takes 1-2 minutes)" -ForegroundColor Gray

$maxWaitTime = 300
$startTime = Get-Date
$completed = $false

while (-not $completed -and ((Get-Date) - $startTime).TotalSeconds -lt $maxWaitTime) {
    Start-Sleep -Seconds 10
    
    $status = aws cloudfront get-invalidation --distribution-id $distributionId --id $invalidationId --query "Invalidation.Status" --output text
    
    if ($status -eq "Completed") {
        $completed = $true
        Write-Host "Invalidation completed!" -ForegroundColor Green
    } else {
        Write-Host "Status: $status..." -ForegroundColor Gray
    }
}

if (-not $completed) {
    Write-Host "Invalidation is taking longer than expected" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Cyan
Write-Host "Custom Domain: https://profolia.solutionsynth.cloud" -ForegroundColor Green
Write-Host "CloudFront URL: https://d1z84d8wvqa2s7.cloudfront.net" -ForegroundColor Green
Write-Host ""
