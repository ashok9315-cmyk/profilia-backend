#!/bin/bash
# Quick frontend deployment script for Profilia
# Uploads frontend files to S3 and invalidates CloudFront cache

set -e

echo "🚀 Profilia Frontend Deployment Script"
echo "======================================="
echo ""

# Get AWS account ID
echo "📋 Getting AWS account information..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Configuration
WEBSITE_BUCKET="profilia-website-${ACCOUNT_ID}"
DISTRIBUTION_ID="E1DYHLPY2DJX26"
FRONTEND_PATH="public_html"

echo "✅ Account ID: ${ACCOUNT_ID}"
echo "📦 S3 Bucket: ${WEBSITE_BUCKET}"
echo "☁️  CloudFront Distribution: ${DISTRIBUTION_ID}"
echo ""

# Check if frontend directory exists
if [ ! -d "$FRONTEND_PATH" ]; then
    echo "❌ Frontend directory '$FRONTEND_PATH' not found!"
    exit 1
fi

# Upload to S3
echo "📤 Uploading files to S3..."
aws s3 sync "$FRONTEND_PATH" "s3://${WEBSITE_BUCKET}/" --delete --exclude "*.md" --exclude ".git/*"
echo "✅ Files uploaded successfully!"
echo ""

# Create CloudFront invalidation
echo "🔄 Invalidating CloudFront cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*" \
    --query "Invalidation.Id" \
    --output text)

echo "✅ Invalidation created: ${INVALIDATION_ID}"
echo ""

# Wait for invalidation to complete
echo "⏳ Waiting for invalidation to complete..."
echo "   (This usually takes 1-2 minutes)"

MAX_WAIT=300  # 5 minutes
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
    sleep 10
    ELAPSED=$((ELAPSED + 10))
    
    STATUS=$(aws cloudfront get-invalidation \
        --distribution-id "$DISTRIBUTION_ID" \
        --id "$INVALIDATION_ID" \
        --query "Invalidation.Status" \
        --output text)
    
    if [ "$STATUS" == "Completed" ]; then
        echo "✅ Invalidation completed!"
        break
    else
        echo "   Status: ${STATUS}..."
    fi
done

if [ "$STATUS" != "Completed" ]; then
    echo "⚠️  Invalidation is taking longer than expected (still in progress)"
    echo "   You can check status later with:"
    echo "   aws cloudfront get-invalidation --distribution-id $DISTRIBUTION_ID --id $INVALIDATION_ID"
fi

echo ""
echo "🎉 Deployment Complete!"
echo "======================================="
echo "🌐 Your site: https://profolia.solutionsynth.cloud"
echo "🌐 CloudFront: https://d1z84d8wvqa2s7.cloudfront.net"
echo ""
