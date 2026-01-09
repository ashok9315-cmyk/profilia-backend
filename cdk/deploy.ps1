#!/usr/bin/env pwsh
# Deployment script for Profilia Backend

Write-Host "🚀 Profilia Deployment Script" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Check if .env file exists
if (-not (Test-Path "../.env")) {
    Write-Host "❌ Error: .env file not found!" -ForegroundColor Red
    Write-Host "Please create .env file with OPENAI_API_KEY" -ForegroundColor Yellow
    exit 1
}

# Check if CDK is installed
try {
    $cdkVersion = cdk --version
    Write-Host "✅ AWS CDK installed: $cdkVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS CDK not installed!" -ForegroundColor Red
    Write-Host "Installing AWS CDK globally..." -ForegroundColor Yellow
    npm install -g aws-cdk
}

# Check AWS credentials
try {
    $awsIdentity = aws sts get-caller-identity 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ AWS credentials configured" -ForegroundColor Green
    } else {
        throw "AWS credentials not configured"
    }
} catch {
    Write-Host "❌ AWS credentials not configured!" -ForegroundColor Red
    Write-Host "Please run: aws configure" -ForegroundColor Yellow
    exit 1
}

# Install backend dependencies
Write-Host "`n📦 Installing backend dependencies..." -ForegroundColor Cyan
Set-Location ..
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install backend dependencies" -ForegroundColor Red
    exit 1
}

# Install CDK dependencies
Write-Host "`n📦 Installing CDK dependencies..." -ForegroundColor Cyan
Set-Location cdk
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install CDK dependencies" -ForegroundColor Red
    exit 1
}

# Build TypeScript
Write-Host "`n🔨 Building CDK TypeScript..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build TypeScript" -ForegroundColor Red
    exit 1
}

# Synthesize CloudFormation
Write-Host "`n🔄 Synthesizing CloudFormation template..." -ForegroundColor Cyan
cdk synth
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ CDK synthesis failed" -ForegroundColor Red
    exit 1
}

# Ask for confirmation
Write-Host "`n⚠️  This will deploy the following resources:" -ForegroundColor Yellow
Write-Host "   - Lambda Function (15 min timeout)" -ForegroundColor White
Write-Host "   - DynamoDB Table (progress tracking)" -ForegroundColor White
Write-Host "   - S3 Buckets (portfolios + website)" -ForegroundColor White
Write-Host "   - CloudFront Distribution" -ForegroundColor White
Write-Host "   - Lambda Function URL" -ForegroundColor White

$confirm = Read-Host "`nDo you want to proceed? (y/n)"
if ($confirm -ne "y") {
    Write-Host "❌ Deployment cancelled" -ForegroundColor Red
    exit 0
}

# Deploy
Write-Host "`n🚀 Deploying to AWS..." -ForegroundColor Cyan
cdk deploy --all --require-approval never

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Deployment successful!" -ForegroundColor Green
    Write-Host "`n📋 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Copy the CloudFront URL from outputs" -ForegroundColor White
    Write-Host "   2. Open it in your browser" -ForegroundColor White
    Write-Host "   3. Upload a resume to test!" -ForegroundColor White
    Write-Host "`n   To view logs: aws logs tail /aws/lambda/profilia-portfolio-generator --follow" -ForegroundColor Gray
} else {
    Write-Host "`n❌ Deployment failed!" -ForegroundColor Red
    Write-Host "Check the error messages above for details" -ForegroundColor Yellow
    exit 1
}
